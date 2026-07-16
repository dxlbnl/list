---
title: Test setup — two projects, three tiers
type: mechanism
status: accepted
tags: [testing, vitest, ci, playwright, browser, node, pglite, commands, env-test]
---
Vitest (`vite.config.ts`) runs as **two projects**. **`client`** is a browser project — Svelte component tests via `vitest-browser-svelte` on the Playwright **chromium** provider (headless); it matches `src/**/*.svelte.{test,spec}.ts` and loads `src/lib/test/setup.client.ts` (wires `fake-indexeddb/auto` for Dexie + stubs `$app`/`$env`). **`server`** is a node project — everything else (plain unit tests plus [pglite](pglite.md) DB-integration); it matches `src/**/*.{test,spec}.ts` (excluding `*.svelte.*`) and loads `setup.node.ts` (deterministic `$env`/`$app` stubs). This yields **three tiers**: node unit, browser/Svelte, and pglite integration. `expect.requireAssertions` is on — every test must assert.

Commands: `pnpm test` (CI mode, `--run`); `pnpm test:unit` (interactive/watch); `pnpm test:unit --project server` to skip the browser tier; `pnpm check` (`svelte-kit sync --mode test` + `svelte-check`); `pnpm lint` (ESLint). Test files are co-located next to source; the shared harness + [fixtures](fixtures.md) live in `src/lib/test/`. `.env.test` is **committed** (non-secret public placeholders) so `$env/static/public` types generate and modules import cleanly; Vitest loads it in test mode, and `pnpm check` loads it via `svelte-kit sync --mode test`. CI (`.github/workflows/ci.yml`, pinned Node 22 + pnpm 10.33.0) runs install → install chromium → `pnpm check` → `pnpm lint` → `pnpm test` on every push/PR; all steps block. See [the-rules](../project/the-rules.md) for the binding testing MUST-rules.

**Why:** two projects because the browser and node tiers need different environments (real chromium DOM vs. plain node) and file globs keep them from cross-running. Chromium can't be downloaded inside the dev container, so the browser tier's proof-of-green is the **CI step** that installs it — locally you run `pnpm exec playwright install chromium` once. `.env.test` is committed (public placeholders only, no secrets) so type-gen and imports work on a fresh clone with no local setup.
