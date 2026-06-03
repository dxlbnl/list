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

- **Test runner**: Vitest (with `vitest-browser-svelte` / Playwright browser provider).
- **Test command**: `pnpm test` (CI mode, `--run`); `pnpm test:unit` for interactive.
- **Type check**: `pnpm check` (svelte-kit sync + svelte-check).
- **Lint**: `pnpm lint` (ESLint).
- **Test file location**: co-located `*.test.ts` / `*.spec.ts` next to source.

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
