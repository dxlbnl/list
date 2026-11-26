import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
	const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
	try {
		await withMigrationsThrough('0003_list_mcp_oauth', (migrationsFolder) =>
			migrate(drizzle(client), { migrationsFolder })
		);
		console.log('Applied Drizzle migrations through 0003.');
	} catch {
		console.error('Could not apply the MCP expansion. Check the database connection and migration history.');
		process.exitCode = 1;
	} finally {
		await client.end();
	}
}
