/**
 * Schema-derived test fixture world.
 *
 * A single `zod4-mock` world is configured against the project's Zod schemas
 * (`src/lib/validations.ts` — the single source of truth for wire/DB/client
 * shapes) and exported for direct use by tests. A fixed seed makes every run
 * reproducible.
 *
 * `itemSchema` is registered with a `list` relation pointing at `listSchema`,
 * and a `listId` matcher that resolves to the related list's `id`. When an
 * item is generated, `zod4-mock` auto-provisions (or picks) a list from the
 * registry and stamps its `id` onto the item — so `item.listId` is always a
 * real list id, with no manual FK wiring at call sites.
 *
 * Call sites consume the library API directly:
 *   - `world.generate(listSchema)` / `world.generate(itemSchema)` for one record
 *   - `world.generate(listSchema, { overrides: { name: 'Groceries' } })` to pin fields
 *   - `world.populate(listSchema, 1)` + `world.generate(z.array(itemSchema).length(N))`
 *     for a coherent parent + N children graph; recover the parent via
 *     `world.registry.pick(listSchema)`.
 */
import { createWorld } from 'zod4-mock';
import { itemSchema, listSchema } from '$lib/validations';

/** Fixed seed → byte-identical fixtures on every run / machine. */
export const FIXTURE_SEED = 42;

/** Shared, deterministic generator world. See module doc for usage. */
export const world = createWorld({ seed: FIXTURE_SEED })
	.withSchema(listSchema)
	.withSchema(itemSchema, {
		relations: { list: listSchema },
		matchers: {
			listId: (ctx) => ctx.related('list').id
		}
	});
