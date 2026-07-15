---
title: Sync engine invariant safety net — pending-wins + reconciliation lock-down
type: chore
priority: medium
flags: []
created: 2026-06-04
---

## What / why

The client-side sync engine (`src/lib/client/sync.svelte.ts`) has two load-bearing
invariants that should be locked in by tests so future refactors (or accidents) can't
regress them silently:

- **Pending-wins** — `isOperationPending(entityId)` identifies queued ops by their
  `data.id` (the entity's id), NOT by `op.id` (the operation's own nanoid). This is the
  only reason offline edits survive realtime overwrites — if the predicate ever flips, an
  incoming realtime event clobbers the user's pending change.
- **Reconciliation** — `reconcileAllLists` deletes locally-known lists that are absent
  from the server's view (and not `isLocalOnly`). Straightforward but high blast radius —
  a regression would either lose the user's dashboard (delete too much) or stop
  reconciling at all (drift forever).

(Surfaced by the test-coverage audit as findings T11 + T12.)

## Acceptance (chore, tests-first encouraged; tests are characterisation)

1. **Pending-wins (node + fake-indexeddb).** Seed `db.syncQueue` with an op whose
   `data.id = "X"` and own `op.id = "Y"`; assert `isOperationPending("X")` is true and
   `isOperationPending("Y")` is false (catches the bug where the predicate accidentally
   checks the op's own nanoid).
2. **Reconciliation deletes-absent (node + fake-indexeddb).** Seed Dexie with three lists
   (one marked `isLocalOnly: true`); call `reconcileAllLists` with a server response
   containing only one of them; assert: the matching list stays, the `isLocalOnly` list
   stays, the third list is deleted.
3. Mark the tests as characterisation — they pass against current code.
4. Full suite green.

## Notes

- Independent of the server-CTE cards — different code surface (client engine, not the
  CTE).
- Consume the registered `zod4-mock` `world` from `src/lib/test/fixtures.ts` directly —
  see [fixtures](../knowledge/testing/fixtures.md).
- See [sync-model](../knowledge/architecture/sync-model.md) and
  [client-modules](../knowledge/architecture/client-modules.md) for the engine;
  [test-setup](../knowledge/testing/test-setup.md) for the node + fake-indexeddb tier.
