/**
 * In-process Postgres harness for DB-integration tests.
 *
 * Boots a fresh `@electric-sql/pglite` database with the project's Drizzle
 * schema (`src/lib/server/db/schema.ts`) applied as DDL — no Docker, no
 * network. The raw-SQL sync CTE and `auth.ts` can be exercised against real
 * SQL. Call `createTestDb()` once per suite/test for an isolated database.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '$lib/server/db/schema';

/** A test database plus a teardown handle. */
export interface TestDb {
	db: PgliteDatabase<typeof schema>;
	client: PGlite;
	/** Release the in-memory database. */
	close: () => Promise<void>;
}

/**
 * Create a fresh in-memory Postgres with the Drizzle schema applied.
 * Each call is an isolated database, so suites do not share state.
 */
export async function createTestDb(): Promise<TestDb> {
	const client = new PGlite();
	const db = drizzle(client, { schema });

	// Derive CREATE TABLE DDL by diffing an empty schema against ours, then
	// apply each statement. This keeps the harness in lock-step with
	// schema.ts without checked-in migrations.
	const empty = generateDrizzleJson({});
	const current = generateDrizzleJson(schema as Record<string, unknown>);
	const statements = await generateMigration(empty, current);

	for (const statement of statements) {
		await client.exec(statement);
	}

	return {
		db,
		client,
		close: () => client.close()
	};
}
