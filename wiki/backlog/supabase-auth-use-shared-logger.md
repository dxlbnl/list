---
title: Replace console.error in supabase-auth.ts with the shared logger
type: chore
priority: low
flags: []
created: 2026-06-04
---

## What / why

`src/lib/server/supabase-auth.ts` uses `console.error` directly (three call sites),
violating the binding rule that server code MUST use the shared `logger` from `$lib/logger`
(not `console.*`) and call `logger.flush()` before returning from endpoints. The effect:
token-signing errors aren't shipped to Axiom in prod — silent breakage on JWT issuance
failures. (Surfaced by the test-coverage audit as finding L4.)

Trivial and behaviour-neutral — three call sites, no schema/API change, no new dependency.
The only caveat: if the shared logger needs a `flush` semantically different from
`console.error` at these sites, treat the change as full rather than trivial.

## Acceptance

1. Replace the three `console.error` calls with `logger.error`, importing the shared
   logger from `$lib/logger`.
2. No new tests required — this is rule compliance, not behavioural.
3. `pnpm check`, `pnpm lint`, `pnpm test` stay green.

## Notes

- The binding rule lives in [the-rules](../knowledge/project/the-rules.md); the logger
  mechanism (isomorphic logger + `flush()`) in
  [logging](../knowledge/conventions/logging.md); this file is described in
  [server-modules](../knowledge/architecture/server-modules.md).
