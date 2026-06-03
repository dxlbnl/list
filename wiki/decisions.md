# Decision Log

> Append-only, ADR-style rationale archive. Newest at the bottom. Never edit a past
> entry — supersede it with a new one and link both.
>
> **What belongs here.** Only a decision that establishes or changes a **standing
> constraint** — a choice future work must obey beyond the current item: a dependency or
> tool to use (or a ban on an alternative), a pattern code must follow, or an
> architectural boundary. Test: *would an agent building an unrelated future item need to
> know this?* If yes, it belongs here **and** as a one-line rule in `architecture.md`'s
> Rules section (the manager adds the rule). If it is local to one item (how a single
> function is shaped, a one-off value), it does **not** belong here — note it in
> `progress.md` instead. This bar keeps the log tight and guarantees every entry has a
> binding rule pointing back at it.

## Format

```
## D<n>: <title>
- **Date**: <YYYY-MM-DD>
- **By**: <agent or user>
- **Context**: <what prompted the decision>
- **Decision**: <what was decided>
- **Consequences**: <trade-offs, follow-ups>
- **Rule added/changed**: <the architecture.md Rules line this produced, or "none" if it only supersedes an earlier rule>
- **Supersedes**: <D<n> or "none">
```

---

<!-- entries start here -->

## D1: Testing foundation — pglite, zod4-mock, CI gate

- **Date**: 2026-06-03
- **By**: implementer (B1)
- **Context**: Later fixes (notably the sync-authz bugs) need real regression tests, so
  the project needs a runnable test foundation with harnesses for each test kind. Docker
  won't run in the web container, so Testcontainers is out.
- **Decision**:
  1. **DB-integration tests use `@electric-sql/pglite`** — in-process Postgres booted
     from the Drizzle schema (`src/lib/server/db/schema.ts`) per suite via the
     `src/lib/test/pglite.ts` harness. No Docker, no network.
  2. **Test fixtures are schema-derived via `zod4-mock`** — `src/lib/test/fixtures.ts`
     feeds the Zod schemas in `src/lib/validations.ts` (the single source of truth) to
     `zod4-mock` with a fixed seed. The same fixtures seed both Dexie (client) and pglite
     (DB) tests, so there is one consistent data source.
  3. **CI gates the suite** — `.github/workflows/ci.yml` gates `pnpm check`, `pnpm lint`,
     and `pnpm test` on every push/PR (pinned Node 22 + pnpm 10.33.0). (Lint was initially
     non-blocking pending **B2**; B2 cleared the pre-existing lint baseline and made it
     blocking.) CI is the proof the browser tier is green, since the chromium download is
     blocked in the dev container.
- **Consequences**: New devDependencies (`@electric-sql/pglite`, `fake-indexeddb`,
  `zod4-mock`). Browser (`client`) Vitest project requires a Playwright chromium install
  (a CI step; one-time locally). A committed `.env.test` supplies non-secret public env
  placeholders so types generate and modules import under test.
- **Rule added/changed**: promoted to `architecture.md` Rules (binding) on B1 completion —
  "DB-integration tests **MUST** use the in-process `pglite` harness
  (`src/lib/test/pglite.ts`), not Docker/Testcontainers."; "Test fixtures **MUST** be
  derived from the `src/lib/validations.ts` Zod schemas via `zod4-mock`
  (`src/lib/test/fixtures.ts`); do not hand-roll parallel test data."; "CI
  (`.github/workflows/ci.yml`) **MUST** gate `pnpm check`, `pnpm lint`, and `pnpm test` on
  every push/PR." (B2 cleared the pre-existing lint baseline and made lint blocking.)
- **Supersedes**: none

## D2: Tests consume the `zod4-mock` world directly — no fixture wrappers

- **Date**: 2026-06-03
- **By**: implementer (B3)
- **Context**: The first iteration of `src/lib/test/fixtures.ts` (B1) wrapped the
  registered `world` in helper functions — `listFixture()`, `itemFixture()`,
  `listWithItemsFixture()`. The user rejected this on review: the wrappers hid the
  library and let a real bug slip in (`listWithItemsFixture()` generated a list,
  then **stamped** `listId` onto each item by hand, bypassing the `relations` /
  `matchers` registration entirely). The library already has a native API for every
  case the wrappers were covering: `world.generate(schema)`,
  `world.generate(schema, { overrides })`, `world.populate(parent, 1)` +
  `world.generate(z.array(child).length(N))` + `world.registry.pick(parent)` for
  coherent parent+children graphs.
- **Decision**: Test code in `src/lib/test/**` consumes the registered `zod4-mock`
  `world` (exported from `src/lib/test/fixtures.ts`) directly. No fixture wrapper
  helpers, no manual FK construction (no `item.listId = list.id`-style lines), no
  re-export shims under old names. Coherent relational data is produced via the
  library's registered relations/matchers, not by hand-wiring in test code.
- **Consequences**: Tests are slightly more verbose at call sites but use one
  consistent, library-native vocabulary; bugs of the "stamp FK by hand and bypass
  the matcher" shape become structurally impossible because there is no helper to
  hide them in. If a relational pattern keeps recurring, the right fix is a richer
  schema registration on the world, not a wrapper function above it.
- **Rule added/changed**: candidate rule for promotion to `architecture.md` Rules —
  "Test code **MUST** consume the registered `zod4-mock` `world` from
  `src/lib/test/fixtures.ts` directly; **MUST NOT** wrap it in fixture helper
  functions, and **MUST NOT** hand-stamp foreign keys in test code (use the world's
  registered relations/matchers). applies: `src/**/*.spec.ts`"
- **Supersedes**: none
