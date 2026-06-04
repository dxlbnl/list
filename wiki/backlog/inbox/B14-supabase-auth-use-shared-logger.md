---
id: B14
title: Replace `console.error` in `supabase-auth.ts` with the shared logger
type: chore
priority: low
mode: lite
created: 2026-06-04
---

## Description

From B6 audit L4. `src/lib/server/supabase-auth.ts:15, 23, 44` use
`console.error` directly, violating the architecture.md Rule "Server code
**MUST** use the shared `logger` from `$lib/logger` (not `console.log`)
and call `logger.flush()` before returning from endpoints." This means
token-signing errors aren't shipped to Axiom in prod — silent breakage on
JWT issuance failures.

## Acceptance

1. Replace the three `console.error` calls with `logger.error` (import
   the shared logger from `$lib/logger`).
2. No new tests required — this is rule compliance, not behavioural.
3. `pnpm check`, `pnpm lint`, `pnpm test` stay green.

## Notes

- Audit reference: `wiki/research/test-coverage-audit.md` L4.
- `mode: lite`: trivial, behaviour-neutral (assuming both loggers route
  errors equivalently; if the logger requires a `flush` semantically
  different from `console.error`, the manager auto-promotes to full).
  Three call sites, no schema/API change, no security implication beyond
  fixing the existing silent-failure problem.
