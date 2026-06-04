---
id: B13
title: Sync engine invariant safety net — pending-wins + reconciliation lock-down
type: chore
priority: medium
created: 2026-06-04
---

## Description

From B6 audit T11 + T12. The client-side sync engine
(`src/lib/client/sync.svelte.ts`) has two load-bearing invariants that
should be locked in by tests so future refactors (or accidents) can't
regress them silently:

- **Pending-wins** (T11): `isOperationPending(entityId)` identifies queued
  ops by their `data.id` (the entity's id), NOT by `op.id` (the
  operation's own nanoid). This is the only reason offline edits survive
  realtime overwrites — if the predicate ever flips, an incoming realtime
  event clobbers the user's pending change.
- **Reconciliation** (T12): `reconcileAllLists` deletes locally-known
  lists that are absent from the server's view (and not `isLocalOnly`).
  Straightforward but high blast radius — a regression would either lose
  the user's dashboard (delete too much) or stop reconciling at all (drift
  forever).

## Acceptance (definition of done — chore, tests-first encouraged)

1. **T11 — pending-wins (node + fake-indexeddb).** Seed `db.syncQueue`
   with an op whose `data.id = "X"` and own `op.id = "Y"`; assert
   `isOperationPending("X")` is true; assert `isOperationPending("Y")` is
   false (catches the bug where the predicate accidentally checks the
   op's own nanoid).
2. **T12 — reconciliation deletes-absent (node + fake-indexeddb).** Seed
   Dexie with three lists (one marked `isLocalOnly: true`); call
   `reconcileAllLists` with a server response that contains only one of
   them; assert: the matching list stays, the `isLocalOnly` list stays,
   the third list is deleted.
3. Tests are characterisation — pass against current code, mark as such.
4. Full suite green.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` T11 + T12.
- Independent of B8/B10/B11 — different code surface (client engine, not
  server CTE).
- Use the world from `src/lib/test/fixtures.ts` directly (D2 Rule).
