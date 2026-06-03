---
id: B3
title: Make zod4-mock fixtures relational (coherent list↔item FK)
type: chore
priority: medium
created: 2026-06-03
---

## Description

`src/lib/test/fixtures.ts` (from B1) creates a seeded `zod4-mock` world but never
registers any schema, so it only buys determinism — the world's real power (matchers,
**relations**, derived shapes) sits unused. Concretely, `listFixture()` and `itemFixture()`
generate independently, so `item.listId` (an FK to `list.id`, see `validations.ts:9`)
matches no generated list. The pglite smoke test currently hand-wires that FK.

Use the world properly: register the schemas with a relation so `item.listId` references a
generated list automatically, and add a few domain matchers so fixtures read realistically.
This makes the fixtures meaningful and lets the pglite harness drop its manual FK seeding.

User-approved 2026-06-03 (chose "make it relational" over leaving as-is / dropping the world).

## Acceptance (definition of done)

1. `src/lib/test/fixtures.ts` registers `listSchema` and `itemSchema` on the world via
   `.withSchema(...)`, with a relation so a generated item's `listId` equals a generated
   list's `id` — e.g.:
   ```ts
   const world = createWorld({ seed: FIXTURE_SEED })
     .withSchema(listSchema)
     .withSchema(itemSchema, {
       relations: { list: listSchema },
       matchers: { listId: (ctx) => ctx.related('list').id },
     });
   ```
   (Confirm the exact `relations`/`ctx.related` API against the installed `zod4-mock`
   README/types before coding — adjust to match.)
2. Expose a helper that returns a **coherent pair/graph** (a list plus N items whose
   `listId` points at that list), in addition to the existing `listFixture()` /
   `itemFixture()`. Keep the single-entity helpers working (back-compat).
3. `src/lib/test/fixtures.spec.ts` gains an assertion that a generated item's `listId`
   matches its parent list's `id` (the relation actually holds), alongside the existing
   parse + override assertions.
4. `src/lib/test/pglite.spec.ts` (and the harness if it exposes a seed helper) is
   simplified to use the relational fixtures instead of manually constructing the FK.
   The smoke test still passes.
5. Determinism preserved — fixed seed, byte-identical output; do **not** drop the world for
   bare `generate()` (that's unseeded → non-reproducible).
6. `pnpm check` + server test project stay green.

## Notes

- Keep it infra-only; no product code or product tests. Stay within `src/lib/test/**`.
- If `zod4-mock`'s relation API can't express the list↔item FK cleanly (e.g. it needs a
  `from`/derived shape instead of `relations`), implement the closest coherent approach and
  note it in `## Notes`; don't force a pattern that fights the library.
- The list/item schemas also have a `userId` owner FK — coherence there is optional for
  this item (the pglite test seeds a user row); in scope only if trivial.
