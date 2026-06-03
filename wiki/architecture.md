# Architecture

> Short binding index for the workflow. The detailed reference lives in the
> `architecture/` pages (linked from `INDEX.md`); this page is the source of truth for
> the package manager, test runner, and the standing **Rules**.

## Tech stack

- **Language**: TypeScript, Svelte 5 (rune mode: `$state`, `$derived`, `$effect`).
- **Framework**: SvelteKit (`@sveltejs/adapter-vercel`), Vite.
- **Client storage**: IndexedDB via Dexie (offline-first).
- **Server / DB**: Drizzle ORM against Neon (serverless PostgreSQL).
- **Realtime**: Supabase Realtime; server signs ES256 JWTs for client subscriptions.
- **Validation**: Zod (`src/lib/validations.ts` — single source of truth).
- **UI**: Bits UI headless primitives + vanilla, namespaced CSS (no Tailwind).
- **Email**: Resend (magic links).

See `architecture/stack.md`, `architecture/sync-engine.md`, and
`architecture/data-model.md` for depth.

## Package manager (binding)

> Agents must use **only** this package manager. Do not substitute another even if
> tutorials, generated configs, or model priors suggest one.

- **Package manager**: **pnpm** (use only this — not npm, not yarn).

## Test setup

- **Test runner**: Vitest, configured in `vite.config.ts` as **two projects**:
  - **`client`** (browser) — Svelte component tests via `vitest-browser-svelte` on the
    Playwright chromium provider (headless). Matches `src/**/*.svelte.{test,spec}.ts`.
    Setup: `src/lib/test/setup.client.ts` (wires `fake-indexeddb/auto` for Dexie + stubs
    `$app`/`$env`).
  - **`server`** (node) — everything else: plain unit tests and **pglite DB-integration**
    tests. Matches `src/**/*.{test,spec}.ts` (excluding `*.svelte.*`). Setup:
    `src/lib/test/setup.node.ts` (deterministic `$env`/`$app` stubs).
- **Three test tiers**:
  1. **node unit** — pure-logic tests, run by the `server` project.
  2. **browser / Svelte** — component tests, run by the `client` project (needs chromium;
     see CI step below). Locally, run `pnpm exec playwright install chromium` once.
  3. **pglite integration** — real Postgres in-process via `@electric-sql/pglite`; the
     harness in `src/lib/test/pglite.ts` (`createTestDb()`) boots a fresh schema from
     `src/lib/server/db/schema.ts` per call (no Docker/network). Use for the sync CTE and
     `auth.ts`.
- **Fixtures convention**: test data is **schema-derived** — `src/lib/test/fixtures.ts`
  registers the Zod schemas from `src/lib/validations.ts` on a single shared
  **`zod4-mock`** `world` with a fixed seed (deterministic) and exports that `world`
  for direct use. Tests consume the library API directly: `world.generate(schema)` /
  `world.generate(schema, { overrides })` for one record; `world.populate(parent, 1)`
  + `world.generate(z.array(child).length(N))` + `world.registry.pick(parent)` for a
  coherent parent+children graph (the child's `listId` matcher resolves via the
  registered relation, so no FK is stamped in test code). The **same world** seeds
  both Dexie (client) and pglite (DB) tests: generate → schema-validated object →
  insert.
- **Test file location**: co-located `*.test.ts` / `*.spec.ts` next to source; shared
  harness + fixtures live in `src/lib/test/`.
- **Commands**: `pnpm test` (CI mode, `--run`); `pnpm test:unit` for interactive;
  `pnpm test:unit --project server` to skip the browser tier. `pnpm check`
  (svelte-kit sync `--mode test` + svelte-check); `pnpm lint` (ESLint).
- **Test env**: `.env.test` (committed, non-secret placeholders) supplies the public env
  vars so `$env/static/public` types generate and modules import cleanly; Vitest loads it
  in test mode and `pnpm check` loads it via `svelte-kit sync --mode test`.
- **CI**: `.github/workflows/ci.yml` runs `pnpm install`, `pnpm check`, `pnpm lint`,
  `pnpm test` on push/PR (pinned Node 22 + pnpm 10.33.0), installing the Playwright
  chromium browser for the `client` tier. `pnpm check`, `pnpm lint`, and `pnpm test` are
  all blocking.

> Note: the seed `.claude/settings.json` ships only stack-agnostic permissions, so the
> first `pnpm …` run in a session will prompt for approval until pnpm rules are added to
> `permissions.allow`.

## Project structure

```
src/
  lib/
    client/      # Dexie schema (db.ts), local CRUD (actions.ts), sync.svelte.ts
    server/      # Drizzle schema, auth.ts, supabase-auth.ts, db/
    validations.ts   # Zod schemas (wire/DB/client source of truth)
  routes/
    api/sync/    # core batch sync endpoint (single CTE)
    [slug]/      # list detail (ssr disabled)
    login/ join/ settings/
drizzle/         # migrations
wiki/            # this wiki (single source of truth)
```

## Rules (binding)

Standing constraints all future work MUST follow. This is the **propagation channel**:
agents read this page before writing code. Each rule is one line; keywords follow
[RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) (**MUST** / **MUST NOT** /
**SHOULD** / **MAY**). The **manager owns this list** — it promotes a reviewer-flagged
standing constraint into a rule when an item is done. Keep it short; the "why" lives in
`decisions.md`.

- All client-side data mutations **MUST** go through `src/lib/client/actions.ts`; never call `db.*` directly from a component. applies: `src/**`
- The package manager **MUST** be `pnpm`; do not use `npm` or `yarn`.
- UI styling **MUST** be vanilla, namespaced CSS inside the component, wrapped in a `:global {}` block; **MUST NOT** use Tailwind.
- Wire/DB/client data shapes **MUST** be defined by the Zod schemas in `src/lib/validations.ts`; do not hand-roll parallel types.
- Server code **MUST** use the shared `logger` from `$lib/logger` (not `console.log`) and call `logger.flush()` before returning from endpoints.
- Deletion **MUST** be soft (set `deletedAt`); do not hard-delete user data.
- DB-integration tests **MUST** use the in-process `pglite` harness (`src/lib/test/pglite.ts`), not Docker/Testcontainers. applies: `src/**/*.spec.ts`
- Test fixtures **MUST** be schema-derived from `src/lib/validations.ts` via `zod4-mock` (`src/lib/test/fixtures.ts`); do not hand-roll parallel test data. applies: `src/**/*.spec.ts`
- Test code **MUST** consume the registered `zod4-mock` `world` from `src/lib/test/fixtures.ts` directly; **MUST NOT** wrap it in fixture helper functions, and **MUST NOT** hand-stamp foreign keys in test code (use the world's registered relations/matchers). applies: `src/**/*.spec.ts` (see [D2](decisions.md))
- CI (`.github/workflows/ci.yml`) **MUST** gate `pnpm check`, `pnpm lint`, and `pnpm test` on every push/PR.
