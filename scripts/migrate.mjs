import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { bigint, pgSchema, text } from 'drizzle-orm/pg-core';
import postgres from 'postgres';

const source = fileURLToPath(new URL('../drizzle/', import.meta.url));

/**
 * Stage the original journal prefix without changing the SQL bytes or history.
 * @template T
 * @param {string} lastTag
 * @param {(folder: string) => Promise<T>} run
 */
export async function withMigrationsThrough(lastTag, run) {
	/** @type {{ version: string, dialect: string, entries: { tag: string }[] }} */
	const journal = JSON.parse(await readFile(join(source, 'meta', '_journal.json'), 'utf8'));
	const stoppingPoint = journal.entries.findIndex(({ tag }) => tag === lastTag);
	if (stoppingPoint === -1) throw new Error('Migration prefix is missing from the Drizzle journal.');
	const entries = journal.entries.slice(0, stoppingPoint + 1);
	const folder = await mkdtemp(join(tmpdir(), 'list-migrations-'));
	try {
		await mkdir(join(folder, 'meta'));
		await Promise.all([
			writeFile(join(folder, 'meta', '_journal.json'), JSON.stringify({ ...journal, entries })),
			...entries.map(({ tag }) => copyFile(join(source, tag + '.sql'), join(folder, tag + '.sql')))
		]);
		return await run(folder);
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}

const historyMismatch = 'The database migration history does not match the checked-in Drizzle journal.';
const historyTable = pgSchema('drizzle').table('__drizzle_migrations', {
	hash: text('hash').notNull(),
	createdAt: bigint('created_at', { mode: 'number' })
});

/**
 * @param {import('../src/lib/server/ai').ListDb} db
 * @param {string} [migrationsFolder]
 */
export async function migrateListDb(db, migrationsFolder = source) {
	const migrations = readMigrationFiles({ migrationsFolder });
	return db.transaction(async (tx) => {
		await tx.execute(sql`set local lock_timeout = '45s'`);
		await tx.execute(sql`select pg_advisory_xact_lock(1150665, 1)`);
		await tx.execute(sql`create schema if not exists drizzle`);
		await tx.execute(sql`
			create table if not exists drizzle.__drizzle_migrations (
				id serial primary key, hash text not null, created_at bigint
			)
		`);
		const history = await tx.select().from(historyTable).orderBy(historyTable.createdAt);
		if (history.some((row, index) => row.createdAt !== migrations[index]?.folderMillis ||
			row.hash !== migrations[index]?.hash)) {
			throw new Error(historyMismatch);
		}
		const pending = migrations.slice(history.length);
		for (const migration of pending) {
			for (const statement of migration.sql) await tx.execute(sql.raw(statement));
			await tx.insert(historyTable).values({ hash: migration.hash, createdAt: migration.folderMillis });
		}
		return pending.length;
	}, { isolationLevel: 'read committed' });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
	const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });
	try {
		const count = await migrateListDb(drizzle(client));
		console.log(`Database migrations applied: ${count}.`);
	} catch (error) {
		const message = error instanceof Error && error.message === historyMismatch
			? historyMismatch
			: 'Database migration failed. Check the connection, permissions and migration SQL.';
		console.error(message);
		process.exitCode = 1;
	} finally {
		await client.end();
	}
}
