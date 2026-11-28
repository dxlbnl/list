import { writeFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from '$lib/test/pglite';
import { processSyncBatch } from './sync';

const itemsCursor = 'CREATE INDEX items_updated_seq_idx ON items (updated_seq)';
const listsCursor = 'CREATE INDEX lists_updated_seq_idx ON lists (updated_seq)';
const itemListCursor = 'CREATE INDEX items_list_cursor_bench ON items (list_id, updated_seq)';
const configurations = [
	['baseline', []],
	['items', [itemsCursor]],
	['lists', [listsCursor]],
	['both', [itemsCursor, listsCursor]],
	['both + composite', [itemsCursor, listsCursor, itemListCursor]]
] as const;

type Plan = {
	'Execution Time': number;
	Plan: {
		'Shared Hit Blocks': number;
		'Shared Read Blocks': number;
	}
};

const median = (samples: Plan[]) =>
	samples.map((result) => result['Execution Time']).sort((a, b) => a - b)[1];

it.runIf(process.env.BENCH_SYNC_CURSOR === '1')('measures the sync cursor query and index construction', async () => {
	const plans: Record<string, Plan[]> = {};
	const summary = [];

	for (const [name, indexes] of configurations) {
		const { client, db, close } = await createTestDb();
		try {
			await client.exec(`
				DROP INDEX IF EXISTS items_updated_seq_idx, lists_updated_seq_idx;
				INSERT INTO users (id) VALUES ('owner'), ('small'), ('large');
				INSERT INTO lists (id, name, slug, created_by)
					SELECT 'l' || i, 'list ' || i, 'slug-' || i, 'owner'
					FROM generate_series(1, 1000) i;
				INSERT INTO list_users (list_id, user_id)
					SELECT id, 'large' FROM lists
					UNION ALL
					SELECT 'l' || i, 'small' FROM generate_series(1, 10) i;
				INSERT INTO items (id, list_id, name, rank)
					SELECT 'i' || l || '-' || i, 'l' || l, 'item ' || i, i
					FROM generate_series(1, 1000) l
					CROSS JOIN LATERAL generate_series(1, (ARRAY[25, 125, 450])[1 + (l - 1) % 3]) i;
				UPDATE lists SET updated_seq = nextval('sync_seq') WHERE id IN ('l1', 'l501');
			`);

			const buildStart = performance.now();
			if (indexes.length) await client.exec(`BEGIN; ${indexes.join('; ')}; COMMIT;`);
			const buildMs = performance.now() - buildStart;
			await client.exec('ANALYZE');

			const { rows: [counts] } = await client.query<{ cursor: number; items: number }>(`
				SELECT (last_value - 100)::int AS cursor, (SELECT count(*)::int FROM items) AS items
				FROM sync_seq
			`);
			expect(counts.items).toBe(199825);

			for (const user of ['small', 'large']) {
				for (const [range, cursor] of [['recent', counts.cursor], ['initial', 0]] as const) {
					const samples: Plan[] = [];
					for (let run = 0; run < 4; run++) {
						await processSyncBatch({
							execute: async (query) => {
								const result = await db.execute<{ 'QUERY PLAN': Plan[] }>(
									sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
								);
								samples.push(result.rows[0]['QUERY PLAN'][0]);
								return result;
							}
						}, user, [], cursor);
					}
					const warmed = samples.slice(1);
					expect(warmed).toHaveLength(3);
					plans[`${name}: ${user} ${range}`] = warmed;
				}
			}

			const writes: Plan[] = [];
			for (let run = 0; run < 4; run++) {
				const result = await client.query<{ 'QUERY PLAN': Plan[] }>(`
					EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
					UPDATE items SET updated_seq = nextval('sync_seq')
					WHERE id IN (SELECT 'i3-' || i FROM generate_series(1, 450) i
						UNION ALL SELECT 'i6-' || i FROM generate_series(1, 450) i
						UNION ALL SELECT 'i9-' || i FROM generate_series(1, 100) i)
				`);
				writes.push(result.rows[0]['QUERY PLAN'][0]);
			}
			plans[`${name}: update 1,000 items`] = writes.slice(1);
			summary.push({
				name,
				'small recent ms': median(plans[`${name}: small recent`]),
				'large recent ms': median(plans[`${name}: large recent`]),
				'small initial ms': median(plans[`${name}: small initial`]),
				'large initial ms': median(plans[`${name}: large initial`]),
				'update ms': median(writes.slice(1)),
				'build ms': Math.round(buildMs)
			});
		} finally {
			await close();
		}
	}

	console.table(summary);
	if (process.env.BENCH_PLAN_FILE) {
		await writeFile(process.env.BENCH_PLAN_FILE, JSON.stringify({ summary, plans }, null, 2));
	}
}, 240_000);
