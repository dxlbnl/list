---
title: Remove in-app rate limiting (ratelimit.ts, rateLimits table, callers, migration)
type: chore
priority: medium
flags: [review]
created: 2026-06-04
---

## What / why

Rate limiting is delegated to Vercel's platform-level controls (WAF / function-level
limits); the in-app implementation is superseded. This chore removes the dead code so it
can't drift back into use.

To remove:

- `src/lib/server/ratelimit.ts` — the entire module.
- The `rateLimits` table from `src/lib/server/db/schema.ts`.
- The `rateLimit(...)` calls and their imports in `src/routes/login/+page.server.ts` and
  `src/routes/api/auth/clone/+server.ts` (and any other call sites — verify with a grep).
- The Drizzle migration that drops the `rate_limits` table (generate via `pnpm
  db:generate`, review the SQL).
- Any TypeScript types / barrels that re-export the removed symbols.

## Acceptance

1. The module, table, migration, and all callers are removed/updated.
2. `pnpm check`, `pnpm lint`, `pnpm test` all green after the removal.
3. Update the CLAUDE.md "Data Model Highlights" line about in-DB rate limiting to reflect
   the final Vercel-delegated state.
4. The Drizzle migration is reviewed — the drop is destructive; ensure it's a clean
   `DROP TABLE` with no data preservation needed (the table holds transient counters only).
5. No new tests required (we're removing the tests' subject, not adding behaviour).

## Notes

- Rationale (rate limiting → Vercel; do not revive in-app tables/middleware) is the
  binding constraint in [the-rules](../knowledge/project/the-rules.md), with the "why" in
  [auth](../knowledge/domain/auth.md).
- The login + clone endpoints rely on Vercel's WAF / function-level limits after this. No
  Vercel-dashboard configuration is in scope here — that's the user's responsibility. File
  a separate "document the Vercel rate-limit config" item if wanted.
- See [server-modules](../knowledge/architecture/server-modules.md) and
  [data-model](../knowledge/architecture/data-model.md) for the affected surfaces.
- `flags: [review]`: removes a server-side gate; approve the plan (especially the
  migration) before the code is removed.
