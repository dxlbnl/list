import { sql, type SQL } from 'drizzle-orm';
import { lists, items, listUsers } from '$lib/server/db/schema';
import type { ItemOperation, ListOperation, SyncOperation } from '$lib/validations';

/**
 * The core sync-batch processor, extracted from the `/api/sync` endpoint so it
 * can be unit-tested against the in-process pglite harness directly (no HTTP
 * mocking). The endpoint is a thin wrapper: it authenticates, validates, and
 * delegates here. `db` is any Drizzle Postgres executor — Neon in production,
 * pglite in tests.
 */

/** Minimal structural type covering both the Neon and pglite Drizzle executors. */
export interface SyncExecutor {
	execute(query: SQL): Promise<unknown>;
}

export interface SyncResult {
	id: string | number;
	status: 'success' | 'ignored';
}

/** Normalise `db.execute` results across drivers (Neon returns an array, pglite `{ rows }`). */
function rowsOf(result: unknown): Record<string, unknown>[] {
	if (Array.isArray(result)) return result as Record<string, unknown>[];
	if (result && typeof result === 'object' && 'rows' in result) {
		return (result as { rows: Record<string, unknown>[] }).rows;
	}
	return [];
}

export async function processSyncBatch(
	db: SyncExecutor,
	userId: string,
	operations: SyncOperation[]
): Promise<{ results: SyncResult[] }> {
	// 1. PREPARE JSON BATCHES (data is already transformed to DB shape by Zod).
	const itemUpsertsJson = JSON.stringify(
		operations
			.filter((op): op is ItemOperation => op.entity === 'item' && (op.type === 'INSERT' || op.type === 'UPDATE'))
			.map((op) => op.data)
	);
	const listUpsertsJson = JSON.stringify(
		operations
			.filter((op): op is ListOperation => op.entity === 'list' && (op.type === 'INSERT' || op.type === 'UPDATE'))
			.map((op) => op.data)
	);
	const listDeletesJson = JSON.stringify(
		operations.filter((o) => o.type === 'DELETE' && o.entity === 'list').map((o) => o.data.id)
	);
	const itemDeletesJson = JSON.stringify(
		operations.filter((o) => o.type === 'DELETE' && o.entity === 'item').map((o) => o.data.id)
	);

	// 2. EXECUTE THE SINGLE ATOMIC CTE BATCH (Exactly 1 Round Trip).
	const result = await db.execute(sql`
		WITH
		list_input AS (
			SELECT DISTINCT ON (id) *
			FROM jsonb_populate_recordset(null::${lists}, ${listUpsertsJson}::jsonb)
			ORDER BY id, created_at DESC
		),
		item_input AS (
			-- Coalesce all ops for the same id (an INSERT + later partial UPDATE can batch
			-- together): last-write-wins per field by updated_at, never overwriting a
			-- provided field with a null from a partial op. Prevents same-id data loss.
			SELECT
				id,
				(array_agg(list_id    ORDER BY updated_at DESC) FILTER (WHERE list_id    IS NOT NULL))[1] AS list_id,
				(array_agg(name       ORDER BY updated_at DESC) FILTER (WHERE name       IS NOT NULL))[1] AS name,
				(array_agg(group_name ORDER BY updated_at DESC) FILTER (WHERE group_name IS NOT NULL))[1] AS group_name,
				(array_agg(rank       ORDER BY updated_at DESC) FILTER (WHERE rank       IS NOT NULL))[1] AS rank,
				(array_agg(done       ORDER BY updated_at DESC) FILTER (WHERE done       IS NOT NULL))[1] AS done,
				(array_agg(deleted_at ORDER BY updated_at DESC) FILTER (WHERE deleted_at IS NOT NULL))[1] AS deleted_at,
				max(updated_at) AS updated_at
			FROM jsonb_populate_recordset(null::${items}, ${itemUpsertsJson}::jsonb)
			GROUP BY id
		),
		list_deletes AS (SELECT DISTINCT value as id FROM jsonb_array_elements_text(${listDeletesJson}::jsonb)),
		item_deletes AS (SELECT DISTINCT value as id FROM jsonb_array_elements_text(${itemDeletesJson}::jsonb)),

		upsert_lists AS (
			INSERT INTO ${lists} (id, slug, name, created_by, created_at)
			-- Force created_by to the authenticated user: the client-supplied created_by
			-- is ignored on INSERT so ownership can't be spoofed to another user id.
			SELECT id, slug, name, ${userId}, created_at FROM list_input d
			WHERE NOT EXISTS (SELECT 1 FROM ${lists} l WHERE l.id = d.id)
			   OR EXISTS (SELECT 1 FROM ${lists} l WHERE l.id = d.id AND l.created_by = ${userId})
			ON CONFLICT (id) DO UPDATE SET
				name = COALESCE(EXCLUDED.name, ${lists.name}),
				slug = COALESCE(EXCLUDED.slug, ${lists.slug})
			RETURNING id
		),
		upsert_members AS (
			INSERT INTO ${listUsers} (list_id, user_id)
			SELECT id, ${userId} FROM list_input
			ON CONFLICT DO NOTHING
		),
		upsert_items AS (
			INSERT INTO ${items} (id, list_id, name, group_name, rank, done, deleted_at, updated_at)
			SELECT
				d.id,
				COALESCE(d.list_id, i.list_id),
				COALESCE(d.name, i.name),
				COALESCE(d.group_name, i.group_name),
				COALESCE(d.rank, i.rank),
				COALESCE(d.done, i.done),
				COALESCE(d.deleted_at, i.deleted_at),
				d.updated_at
			FROM item_input d
			LEFT JOIN ${items} i ON d.id = i.id
			WHERE
				(i.id IS NOT NULL AND EXISTS (SELECT 1 FROM ${listUsers} lu WHERE lu.list_id = i.list_id AND lu.user_id = ${userId}))
				OR
				(d.list_id IS NOT NULL AND d.name IS NOT NULL AND EXISTS (SELECT 1 FROM ${listUsers} lu WHERE lu.list_id = d.list_id AND lu.user_id = ${userId}))
			ON CONFLICT (id) DO UPDATE SET
				list_id = COALESCE(EXCLUDED.list_id, ${items.listId}),
				name = COALESCE(EXCLUDED.name, ${items.name}),
				group_name = COALESCE(EXCLUDED.group_name, ${items.groupName}),
				rank = COALESCE(EXCLUDED.rank, ${items.rank}),
				done = COALESCE(EXCLUDED.done, ${items.done}),
				deleted_at = COALESCE(EXCLUDED.deleted_at, ${items.deletedAt}),
				updated_at = EXCLUDED.updated_at
			WHERE ${items.updatedAt} < EXCLUDED.updated_at
			RETURNING id
		),
		del_lists_owner AS (
			DELETE FROM ${lists} WHERE id IN (SELECT id FROM list_deletes) AND created_by = ${userId}
		),
		del_members AS (
			DELETE FROM ${listUsers} WHERE list_id IN (SELECT id FROM list_deletes) AND user_id = ${userId}
		),
		del_items AS (
			DELETE FROM ${items} WHERE id IN (SELECT id FROM item_deletes)
			AND (
				list_id IN (SELECT list_id FROM ${listUsers} WHERE user_id = ${userId})
				OR
				list_id IN (SELECT id FROM ${lists} WHERE created_by = ${userId})
			)
		)
		SELECT
			(SELECT COALESCE(array_agg(id), ARRAY[]::text[]) FROM upsert_lists) AS written_list_ids,
			(SELECT COALESCE(array_agg(id), ARRAY[]::text[]) FROM upsert_items) AS written_item_ids;
	`);

	const row = rowsOf(result)[0] as { written_list_ids: string[]; written_item_ids: string[] } | undefined;
	const writtenListIds = new Set<string>(row?.written_list_ids ?? []);
	const writtenItemIds = new Set<string>(row?.written_item_ids ?? []);

	const results: SyncResult[] = operations.map((op) => {
		const entityId = op.data.id as string;
		if (op.type === 'DELETE') return { id: op.id, status: 'success' };
		if (op.entity === 'list' && writtenListIds.has(entityId)) return { id: op.id, status: 'success' };
		if (op.entity === 'item' && writtenItemIds.has(entityId)) return { id: op.id, status: 'success' };
		return { id: op.id, status: 'ignored' };
	});

	return { results };
}
