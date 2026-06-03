---
id: B3
title: Make zod4-mock fixtures relational (use the real zod4-mock API, drop wrappers)
type: chore
priority: medium
created: 2026-06-03
---

## Description

The relational world is **already wired** in `src/lib/test/fixtures.ts` (B1's later iteration):
`.withSchema(listSchema)` + `.withSchema(itemSchema, { relations: { list: listSchema },
matchers: { listId: ctx => ctx.related('list').id } })`. The problem is that the file then
defines hand-rolled wrappers — `listFixture()`, `itemFixture()`, `listWithItemsFixture()` —
that consumers use instead of the world. `listWithItemsFixture()` is particularly wrong: it
generates a list, then generates each item and **stamps** `listId` onto it manually
(`fixtures.ts:73-76`), bypassing the relation/matcher entirely.

**User direction (2026-06-03):** drop the custom functions. Use the real zod4-mock API
directly at call sites. The wrappers are dead weight that hides the library and lets bugs
like the manual-FK-stamp slip in.

## Acceptance (definition of done)

1. **`src/lib/test/fixtures.ts` exports the registered `world` (and `FIXTURE_SEED`) and
   nothing else** — no `listFixture()`, no `itemFixture()`, no `listWithItemsFixture()`, no
   `ListWithItemsFixture` interface. The relational `withSchema(...)` registration stays
   exactly as it is.
2. **Call sites use the zod4-mock API directly.** Single-entity generation becomes
   `world.generate(listSchema)` / `world.generate(itemSchema)` (or whatever the installed
   `zod4-mock` exposes as the canonical generate call — confirm against
   `node_modules/zod4-mock/README.md` + its `.d.ts`). Per-test overrides use the library's
   override mechanism if it has one, else inline object spread at the call site
   (`{ ...world.generate(listSchema), name: 'Groceries' }`).
3. **Coherent list+items graphs use zod4-mock's native graph/relation API**, not a
   hand-rolled "generate list, stamp id on items" loop. Read the library's README/types to
   find the idiomatic pattern (e.g. generating an item and reading the auto-provisioned
   related list back via `ctx.related('list')` or a `world.bind(...)` / batched-generate
   call — exact names depend on the installed version). If — after verifying — the library
   genuinely has no way to express "give me a list with N related items in one go", call
   `world.generate(itemSchema)` N times and recover the shared related list via the world's
   own relation lookup (whatever it's called). The acceptance is **"no manual FK
   construction in test code"**: nowhere in `src/lib/test/**` does a test code line
   manually set `item.listId = list.id`.
4. **`src/lib/test/fixtures.spec.ts` rewritten** to exercise the world directly. Keep at
   least: a parse-against-schema assertion for both schemas, an override demonstration
   (whatever form #2 settled on), and the relation assertion (a generated item's `listId`
   matches its registered/related list's `id`).
5. **`src/lib/test/pglite.spec.ts` rewritten** to use the world directly. The manual FK
   stamping (`graph.items.map(... listId: list.id)`-style logic) goes away. Smoke test
   still passes.
6. **Determinism preserved** — keep `FIXTURE_SEED = 42` and the single shared `world`
   instance; do not switch to bare unseeded generation.
7. **No back-compat shims.** Delete the old wrappers cleanly; do not re-export under old
   names. There are no external consumers of these helpers (they are project-internal,
   `src/lib/test/**` only) so deletion is safe.
8. `pnpm check` + the server test project (`pnpm test --project server`) stay green.

## Notes

- Infra-only — no product code or product tests. Stay within `src/lib/test/**`.
- **Verify the zod4-mock API before coding.** Read `node_modules/zod4-mock/README.md` and
  its `.d.ts` files. The point of this rework is to actually use the library; do not
  invent another wrapper layer in a different shape.
- If, after honest investigation, the library cannot express coherent graphs without a
  thin call-site helper, that's allowed — but it must be a **trivially thin** call into
  the library, not a wrapper that hides the API. Document the choice in this Notes section
  with the specific library limitation that forced it.
- The list/item schemas also have a `userId` owner FK. Coherence there is **optional /
  trivial-only** (the pglite test still seeds an owning user row). If zod4-mock's relation
  registration can also express list→user trivially, fine; otherwise leave it.

## History

- 2026-06-03 — original card filed; acceptance focused on adding the relational
  registration AND exposing a `listWithItemsFixture()` helper alongside back-compat
  `listFixture()` / `itemFixture()` wrappers.
- 2026-06-03 — user reviewed the resulting `fixtures.ts` and rejected the wrapper
  approach: "fixtures.ts isn't good. were not using the power of zod4-mock... drop the
  custom functions. use the real api." Card rewritten by the manager to fold in this
  direction: registration stays, wrappers go, call sites consume the world directly.
