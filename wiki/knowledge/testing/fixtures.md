---
title: Fixtures — the schema-derived zod4-mock world
type: decision
status: accepted
tags: [testing, fixtures, zod4-mock, validations, relations, foreign-keys, seed]
---
Test data is **schema-derived**, never hand-rolled. `src/lib/test/fixtures.ts` registers the Zod schemas from `src/lib/validations.ts` (the wire/DB/client source of truth) on **one shared `zod4-mock` `world`** with a fixed seed (`FIXTURE_SEED = 42`, so fixtures are byte-identical every run) and exports that world. Consume the library API **directly**: `world.generate(schema)` and `world.generate(schema, { overrides })` for one record; for a parent+children graph use `world.populate(listSchema, 1)` + `world.generate(z.array(itemSchema).length(N))` + `world.registry.pick(listSchema)`. `itemSchema` is registered with a `list` relation and a `listId` matcher that resolves to the related list's `id`, so a child's FK is provisioned by the registered relation — **never hand-stamp foreign keys**. The same world seeds both Dexie (client) and [pglite](pglite.md) (DB) tests: generate → schema-validated object → insert. There are **no wrapper helper functions**. See [the-rules](../project/the-rules.md).

**Why:** this is decision D2. Fixture-wrapper helpers had hidden the library and let a real bug slip in — a helper generated a list then **hand-stamped `listId` onto items**, bypassing the registered relations/matchers, so tests ran against incoherent relational data that couldn't occur in production. Coherent relational data must come from the library's registered relations, not hand-wiring; consuming the `world` directly keeps the schema (validations.ts) as the single source of truth for test data too, so tests can never drift from the real shape.
