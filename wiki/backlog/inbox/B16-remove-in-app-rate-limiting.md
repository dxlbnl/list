---
id: B16
title: Remove in-app rate limiting (D4 follow-up: ratelimit.ts, rateLimits table, callers, migration)
type: chore
priority: medium
flags: [review]
created: 2026-06-04
---

## Description

From D4 — rate limiting is delegated to Vercel's platform-level controls;
the in-app implementation is superseded. This chore removes the dead
code so it can't drift back into use.

To remove:

- `src/lib/server/ratelimit.ts` — the entire module.
- `rateLimits` table from `src/lib/server/db/schema.ts`.
- The `rateLimit(...)` calls and their imports in
  `src/routes/login/+page.server.ts` and
  `src/routes/api/auth/clone/+server.ts` (and any other call sites — verify
  with a grep).
- The Drizzle migration that drops the `rate_limits` table (generate via
  `pnpm db:generate`, review the SQL).
- Any TypeScript types / barrels that re-export the removed symbols.

## Acceptance

1. The module, table, migration, and all callers are removed/updated.
2. `pnpm check`, `pnpm lint`, `pnpm test` all green after the removal.
3. The CLAUDE.md "Data Model Highlights" line about in-DB rate limiting
   is updated (this overlaps with B15 — coordinate so the wiki update
   reflects the actual final state).
4. The Drizzle migration is reviewed (drop is destructive — ensure it's
   a clean `DROP TABLE` with no data preservation needed; the table
   contains transient counters only).
5. No new tests required (we're removing tests' subject, not adding
   behaviour).

## Notes

- Decision reference: D4.
- `flags: [review]`: removes a server-side gate. User must approve the
  spec before the code is removed, especially the migration.
- **Sequencing:** B15 (wiki-sync) can land first OR this can — but the
  CLAUDE.md ratelimit note should reflect the final state after both
  land, so coordinate.
- The login + clone endpoints will rely on Vercel's WAF / function-level
  limits after this. No configuration work in this chore — that's the
  user's responsibility in the Vercel dashboard. If a follow-up "document
  the Vercel rate-limit config" item is wanted, file it separately.
