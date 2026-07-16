---
title: The rules — binding constraints
type: reference
status: accepted
tags: [rules, constraints, pnpm, css, tailwind, actions, validations, logger, soft-delete, sessions, rate-limit, ci, testing, fixtures, pglite, zod4-mock]
---

Standing constraints all work MUST follow. Keywords per [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119)
(**MUST** / **MUST NOT** / **SHOULD** / **MAY**). Read this atom before writing code. Keep it short; the
"why" lives in the linked atoms.

- All client-side data mutations **MUST** go through `src/lib/client/actions.ts`; never call `db.*` directly from a component. applies: `src/**` — see [client-modules](../architecture/client-modules.md).
- The package manager **MUST** be `pnpm`; do not use `npm` or `yarn`.
- UI styling **MUST** be vanilla, namespaced CSS inside the component, wrapped in a `:global {}` block; **MUST NOT** use Tailwind. — see [css](../conventions/css.md).
- Wire/DB/client data shapes **MUST** be defined by the Zod schemas in `src/lib/validations.ts`; do not hand-roll parallel types. — see [data-model](../architecture/data-model.md).
- Server code **MUST** use the shared `logger` from `$lib/logger` (not `console.log`) and call `logger.flush()` before returning from endpoints. — see [logging](../conventions/logging.md).
- Deletion **MUST** be soft (set `deletedAt`); do not hard-delete user data. — see [soft-deletes](../domain/soft-deletes.md).
- DB-integration tests **MUST** use the in-process `pglite` harness (`src/lib/test/pglite.ts`), not Docker/Testcontainers. applies: `src/**/*.spec.ts` — see [pglite](../testing/pglite.md).
- Test fixtures **MUST** be schema-derived from `src/lib/validations.ts` via `zod4-mock` (`src/lib/test/fixtures.ts`); do not hand-roll parallel test data. applies: `src/**/*.spec.ts` — see [fixtures](../testing/fixtures.md).
- Test code **MUST** consume the registered `zod4-mock` `world` from `src/lib/test/fixtures.ts` directly; **MUST NOT** wrap it in fixture helper functions, and **MUST NOT** hand-stamp foreign keys in test code (use the world's registered relations/matchers). applies: `src/**/*.spec.ts` — see [fixtures](../testing/fixtures.md).
- Sessions **MUST** persist indefinitely server-side; do not add an `expires_at` column or any forced-expiry behaviour. Explicit logout remains the only way to end a session. — see [auth](../domain/auth.md).
- Rate limiting **MUST** be delegated to Vercel's platform-level controls (WAF / function-level limits); do not add or revive in-app rate-limit middleware or DB tables. — see [auth](../domain/auth.md).
- CI (`.github/workflows/ci.yml`) **MUST** gate `pnpm check`, `pnpm lint`, and `pnpm test` on every push/PR. — see [test-setup](../testing/test-setup.md).

**Why:** these are the promotion channel from real decisions — each was a reviewer-flagged standing
constraint. They exist to keep future work coherent: one mutation path (testable, syncable), one schema
source of truth, recoverable deletes, a runnable test foundation, and a login UX with no forced re-auth.
