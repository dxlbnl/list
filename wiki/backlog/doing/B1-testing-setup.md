---
id: B1
title: Establish testing setup (runnable suite + pglite harness + CI)
type: chore
priority: high
created: 2026-06-03
---

## Description

Stand up a proper, working test foundation so all later fixes (especially the
sync-authz Critical/High bugs) can land with real regression tests. Scope is
**infrastructure only** — no product/unit tests for app modules yet (those come as
follow-up items). The deliverable is: `pnpm test` runs green from a clean checkout,
with documented harnesses for each kind of test we'll need.

## Acceptance (definition of done)

1. **Runnable suite** — `pnpm install` then `pnpm test` completes green. The two
   `src/lib/vitest-examples/` scaffold specs either pass or are removed; the browser
   (client) Vitest project runs (document the `playwright install chromium` step if the
   provider needs it). `pnpm check` and `pnpm lint` also pass.
2. **Test setup file** — a Vitest `setupFiles` wired into the node/client projects that
   provides the shared scaffolding real tests will need: `fake-indexeddb` for Dexie-backed
   client tests, and mocks/stubs for `$env/*` and `$app/*` so server/client modules import
   cleanly under test.
3. **DB-integration harness (pglite)** — an in-process Postgres (`@electric-sql/pglite`)
   helper that boots a fresh schema from the Drizzle schema (`src/lib/server/db/schema.ts`)
   per test/suite, so the raw-SQL sync CTE and `auth.ts` can be tested against real SQL with
   no Docker/network. Include **one** smoke test proving the harness works (e.g. insert a
   row via Drizzle and read it back) — this is harness validation, not product coverage.
4. **CI workflow** — a GitHub Actions workflow (`.github/workflows/ci.yml`) that on push/PR
   runs `pnpm install`, `pnpm check`, `pnpm lint`, and `pnpm test` on a pinned Node + pnpm.
5. **Docs** — `wiki/architecture.md` Test setup section updated to describe the three test
   tiers (node unit, browser/Svelte, pglite integration), the commands, and where each kind
   of test lives. Record the standing choices (pglite for DB tests; CI gates the suite) in
   `wiki/decisions.md`; the manager promotes them to Rules on completion.

## Locked decisions (from user, 2026-06-03)

- **Scope**: infra only — do **not** add product unit tests in this item (validations.ts /
  utils.ts tests are a separate follow-up).
- **DB tests**: use **pglite** (`@electric-sql/pglite`), in-process — not Testcontainers
  (Docker won't run in the web container) and not deferred.
- **CI**: add a GitHub Actions workflow now.

## Out of scope

- Real unit/integration tests for product modules (sync authz, mergeUsers, validations,
  utils, sync.svelte.ts) — those are follow-up items B2+.
- Fixing any of the F1–F8 security findings or complexity issues from the review.

## Notes

- New deps expected (devDependencies): `@electric-sql/pglite`, `fake-indexeddb`, and
  possibly a Drizzle→pglite adapter. Adding dev test tooling is acceptable for this chore;
  keep runtime deps untouched.
- The browser Vitest project uses `@vitest/browser-playwright` (chromium, headless) — see
  `vite.config.ts`. Confirm it runs in CI (may need a Playwright install step in the workflow).
- Reviewer must confirm the suite is **green from clean** (delete `node_modules`/use CI as the
  proof), not just on a warm tree.
