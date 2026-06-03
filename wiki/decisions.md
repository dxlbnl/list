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
  3. **CI gates the suite** — `.github/workflows/ci.yml` gates `pnpm check` and
     `pnpm test` on every push/PR (pinned Node 22 + pnpm 10.33.0). `pnpm lint` also runs
     but is **non-blocking** (`continue-on-error`) until item **B2** clears the
     pre-existing lint baseline, after which lint becomes blocking too. CI is the proof
     the browser tier is green, since the chromium download is blocked in the dev
     container.
- **Consequences**: New devDependencies (`@electric-sql/pglite`, `fake-indexeddb`,
  `zod4-mock`). Browser (`client`) Vitest project requires a Playwright chromium install
  (a CI step; one-time locally). A committed `.env.test` supplies non-secret public env
  placeholders so types generate and modules import under test.
- **Rule added/changed**: promoted to `architecture.md` Rules (binding) on B1 completion —
  "DB-integration tests **MUST** use the in-process `pglite` harness
  (`src/lib/test/pglite.ts`), not Docker/Testcontainers."; "Test fixtures **MUST** be
  derived from the `src/lib/validations.ts` Zod schemas via `zod4-mock`
  (`src/lib/test/fixtures.ts`); do not hand-roll parallel test data."; "CI
  (`.github/workflows/ci.yml`) **MUST** gate `pnpm check` and `pnpm test` on every
  push/PR; `pnpm lint` runs **non-blocking** until item **B2** clears the pre-existing
  lint baseline, after which lint **MUST** become blocking too."
- **Supersedes**: none
