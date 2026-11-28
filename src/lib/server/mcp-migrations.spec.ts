import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { expect, it } from 'vitest';
import { migrateListDb, withMigrationsThrough } from '../../../scripts/migrate.mjs';
import * as schema from './db/schema';
import { createConnectedProposal, decideProposal, pendingProposals } from './ai';
import { world } from '$lib/test/fixtures';
import { listSchema } from '$lib/validations';

const migrationsFolder = 'drizzle';

it('preserves old proposals and migration history through the expand and cleanup phases', async () => {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	const list = world.generate(listSchema);
	try {
		await withMigrationsThrough('0002_overconfident_cerebro', (folder: string) =>
			migrate(db, { migrationsFolder: folder })
		);
		await db.execute(sql`insert into users (id) values (${list.createdBy})`);
		await db.insert(schema.lists).values(list);
		await db.insert(schema.listUsers).values({ listId: list.id, userId: list.createdBy });
		await db.execute(sql`insert into ai_links (id, list_id, token_hash) values ('old-link', ${list.id}, 'old-hash')`);
		const proposed = JSON.stringify([{ name: 'Old item', groupName: '' }]);
		await db.execute(sql`
			insert into ai_proposals (id, list_id, link_id, edit_token_hash, items, version, status, expires_at)
			values
				('old-pending', ${list.id}, 'old-link', 'pending-hash', ${proposed}::jsonb, 3, 'pending', now() + interval '1 day'),
				('old-reviewed', ${list.id}, 'old-link', 'reviewed-hash', ${proposed}::jsonb, 4, 'rejected', now() + interval '1 day')
		`);
		await withMigrationsThrough('0003_list_mcp_oauth', async (folder: string) => {
			const hashes = readMigrationFiles({ migrationsFolder: folder }).map(({ hash }) => hash);
			expect(hashes).toEqual(readMigrationFiles({ migrationsFolder }).slice(0, 4).map(({ hash }) => hash));
			await migrate(db, { migrationsFolder: folder });
			await migrate(db, { migrationsFolder: folder });
		});

		const oldRows = await db.execute(sql`select link_id, edit_token_hash from ai_proposals where id = 'old-pending'`);
		expect(oldRows.rows).toEqual([{ link_id: 'old-link', edit_token_hash: 'pending-hash' }]);
		await db.execute(sql`
			insert into ai_proposals (id, list_id, link_id, edit_token_hash, items, expires_at)
			values ('old-app-write', ${list.id}, 'old-link', 'old-app-hash', ${proposed}::jsonb, now() + interval '1 day')
		`);
		await db.insert(schema.aiConnections).values({
			id: 'new-connection', userId: list.createdBy, clientId: 'client', scopes: ['proposals:create'], activatedAt: new Date()
		});
		const pending = await db.transaction((tx) => createConnectedProposal(tx, 'new-connection', list.createdBy, {
			listId: list.id, items: [{ name: 'New item', groupName: '' }]
		}));
		expect(await db.transaction((tx) => pendingProposals(tx, list.id, list.createdBy))).toHaveLength(3);
		expect(await db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, pending.id, {
			version: 1, decision: 'accepted'
		}))).toMatchObject({ status: 'accepted' });

		await withMigrationsThrough('0004_remove_legacy_ai_links', async (folder: string) => {
			await expect(migrateListDb(db, folder)).resolves.toBe(1);
		});
		const { rows: legacyTables } = await db.execute(sql`select to_regclass('public.ai_links') as name`);
		expect(legacyTables).toEqual([{ name: null }]);
		const { rows: legacyColumns } = await db.execute(sql`
			select column_name from information_schema.columns
			where table_name = 'ai_proposals' and column_name in ('link_id', 'edit_token_hash')
		`);
		expect(legacyColumns).toEqual([]);
		expect(await db.select().from(schema.aiProposals)).toContainEqual(expect.objectContaining({
			id: 'old-reviewed', status: 'rejected', version: 4, connectionId: null
		}));
		await expect(db.transaction((tx) => decideProposal(tx, list.id, list.createdBy, 'old-pending', {
			version: 3, decision: 'accepted'
		}))).resolves.toMatchObject({ status: 'accepted', version: 4 });
		expect((await db.select().from(schema.items)).map(({ name }) => name).sort()).toEqual(['New item', 'Old item']);
		await expect(migrateListDb(db)).resolves.toBe(2);
		const { rows: legacyActivity } = await db.execute(sql`select last_activity_at from users where id = ${list.createdBy}`);
		expect(legacyActivity).toEqual([{ last_activity_at: null }]);
		const { rows: cursorIndexes } = await db.execute(sql`
			select indexname from pg_indexes
			where schemaname = 'public' and indexname in ('items_updated_seq_idx', 'lists_updated_seq_idx')
			order by indexname
		`);
		expect(cursorIndexes).toEqual([
			{ indexname: 'items_updated_seq_idx' },
			{ indexname: 'lists_updated_seq_idx' }
		]);
		const { rows: history } = await db.execute(sql`select hash from drizzle.__drizzle_migrations order by created_at`);
		expect(history).toEqual(readMigrationFiles({ migrationsFolder }).map(({ hash }) => ({ hash })));
	} finally {
		await client.close();
	}
}, 30000);

it('applies the full journal to an empty database and enables RLS for OAuth state', async () => {
	const client = new PGlite();
	const db = drizzle(client, { schema });
	try {
		const results = await Promise.all([migrateListDb(db), migrateListDb(db)]);
		expect(results.sort((a, b) => a - b)).toEqual([0, readMigrationFiles({ migrationsFolder }).length]);
		const { rows } = await db.execute(sql`
			select relname, relrowsecurity from pg_class
			where relname in ('ai_connections','ai_oauth_requests','ai_oauth_codes','ai_oauth_tokens')
			order by relname
		`);
		expect(rows).toEqual(['ai_connections', 'ai_oauth_codes', 'ai_oauth_requests', 'ai_oauth_tokens']
			.map((relname) => ({ relname, relrowsecurity: true })));
	} finally {
		await client.close();
	}
}, 30000);
