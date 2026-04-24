import { db } from '$lib/server/db';
import { lists, items, listUsers } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import { MESSAGES } from '$lib/constants/messages';
import type { RequestHandler } from './$types';
import { syncRequestSchema, type ItemOperation, type ListOperation } from '$lib/validations';
import { logger } from '$lib/logger';

const syncLogger = logger.child({ module: 'sync' });

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) throw error(401, MESSAGES.AUTH.UNAUTHORIZED);

	const body = await request.json();
	const validation = syncRequestSchema.safeParse(body);

	if (!validation.success) {
		syncLogger.error('Sync validation failed', { error: validation.error.format(), userId: user.id });
		throw error(400, `${MESSAGES.DATA.PROCESS_ERROR}: ${validation.error.message}`);
	}

	const { operations, clientId } = validation.data;
	syncLogger.info(`Processing ${operations.length} operations`, { userId: user.id, count: operations.length, clientId });

	const tStart = performance.now();

	try {
		// 1. PREPARE JSON BATCHES
		// Data is already transformed to database format by Zod
		const itemUpsertsJson = JSON.stringify(operations
			.filter((op): op is ItemOperation => 
				op.entity === 'item' && (op.type === 'INSERT' || op.type === 'UPDATE'))
			.map(op => op.data)
		);

		const listUpsertsJson = JSON.stringify(operations
			.filter((op): op is ListOperation => 
				op.entity === 'list' && (op.type === 'INSERT' || op.type === 'UPDATE'))
			.map(op => op.data)
		);

		const listDeletesJson = JSON.stringify(operations.filter(o => o.type === 'DELETE' && o.entity === 'list').map(o => o.data.id));
		const itemDeletesJson = JSON.stringify(operations.filter(o => o.type === 'DELETE' && o.entity === 'item').map(o => o.data.id));

		// 2. EXECUTE THE SINGLE ATOMIC CTE BATCH (Exactly 1 Round Trip)
		await db.execute(sql`
			WITH 
			list_input AS (
				SELECT DISTINCT ON (id) * 
				FROM jsonb_populate_recordset(null::${lists}, ${listUpsertsJson}::jsonb)
				ORDER BY id, created_at DESC
			),
			item_input AS (
				SELECT DISTINCT ON (id) * 
				FROM jsonb_populate_recordset(null::${items}, ${itemUpsertsJson}::jsonb)
				ORDER BY id, updated_at DESC
			),
			list_deletes AS (SELECT DISTINCT value as id FROM jsonb_array_elements_text(${listDeletesJson}::jsonb)),
			item_deletes AS (SELECT DISTINCT value as id FROM jsonb_array_elements_text(${itemDeletesJson}::jsonb)),

			upsert_lists AS (
				INSERT INTO ${lists} (id, slug, name, created_by, created_at)
				SELECT id, slug, name, created_by, created_at FROM list_input d
				WHERE NOT EXISTS (SELECT 1 FROM ${lists} l WHERE l.id = d.id)
				   OR EXISTS (SELECT 1 FROM ${lists} l WHERE l.id = d.id AND l.created_by = ${user.id})
				ON CONFLICT (id) DO UPDATE SET
					name = COALESCE(EXCLUDED.name, ${lists.name}),
					slug = COALESCE(EXCLUDED.slug, ${lists.slug})
				RETURNING id
			),
			upsert_members AS (
				INSERT INTO ${listUsers} (list_id, user_id)
				SELECT id, ${user.id} FROM list_input
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
					(i.id IS NOT NULL AND EXISTS (SELECT 1 FROM ${listUsers} lu WHERE lu.list_id = i.list_id AND lu.user_id = ${user.id}))
					OR
					(d.list_id IS NOT NULL AND d.name IS NOT NULL AND EXISTS (SELECT 1 FROM ${listUsers} lu WHERE lu.list_id = d.list_id AND lu.user_id = ${user.id}))
				ON CONFLICT (id) DO UPDATE SET
					list_id = COALESCE(EXCLUDED.list_id, ${items.listId}),
					name = COALESCE(EXCLUDED.name, ${items.name}),
					group_name = COALESCE(EXCLUDED.group_name, ${items.groupName}),
					rank = COALESCE(EXCLUDED.rank, ${items.rank}),
					done = COALESCE(EXCLUDED.done, ${items.done}),
					deleted_at = COALESCE(EXCLUDED.deleted_at, ${items.deletedAt}),
					updated_at = EXCLUDED.updated_at
				WHERE ${items.updatedAt} < EXCLUDED.updated_at
			),
			del_lists_owner AS (
				DELETE FROM ${lists} WHERE id IN (SELECT id FROM list_deletes) AND created_by = ${user.id}
			),
			del_members AS (
				DELETE FROM ${listUsers} WHERE list_id IN (SELECT id FROM list_deletes) AND user_id = ${user.id}
			),
			del_items AS (
				DELETE FROM ${items} WHERE id IN (SELECT id FROM item_deletes) 
				AND (
					list_id IN (SELECT list_id FROM ${listUsers} WHERE user_id = ${user.id})
					OR 
					list_id IN (SELECT id FROM ${lists} WHERE created_by = ${user.id})
				)
			)
			SELECT 1;
		`);

		const tTotal = performance.now() - tStart;
		syncLogger.info(`Atomic Sync complete`, { tTotal: tTotal.toFixed(2), opCount: operations.length });

		return json({ results: operations.map(op => ({ id: op.id, status: 'success' })) });
	} catch (e: any) {
		syncLogger.error('Sync failed', { userId: user.id, error: e.message });
		throw error(500, `${MESSAGES.DATA.PROCESS_ERROR}: ${e.message}`);
	}
};
