---
title: Concurrent list-create on two devices (same user + slug) aborts the entire sync batch
type: bug
priority: high
flags: [review]
created: 2026-06-04
---

## What / why

`src/lib/client/actions.ts` `createList` only checks the **local** Dexie for slug
collisions before assigning a slug. Realistic scenario: a user is offline on two devices
and both create a "groceries" list for the same logged-in user → both assign slug
"groceries" locally → both queue INSERT ops with different ids but the same
`(created_by, slug)` → device #1 reconnects and flushes, server inserts row #1 → device #2
reconnects and flushes, server tries INSERT row #2 → the `UNIQUE(created_by, slug)`
constraint in `src/lib/server/db/schema.ts` violates. The CTE's `ON CONFLICT (id) DO
UPDATE` only catches PK conflicts, not other unique constraints. The transaction errors
out; the catch in `+server.ts` re-throws as a 500; the client (`processQueue`) sets
`lastSyncError` and **leaves the queue intact**. The user is permanently stuck — every
subsequent flush fails identically until they manually clear local state.

Confirmed by reading the code (surfaced by the test-coverage audit as finding L5); the
exact Postgres CTE error semantics want a reproduction.

## Acceptance (bug track — tests-first)

1. **Foundation test (red, node + fake-indexeddb).** A unit test on `createList` verifying
   the local slug-collision branch picks a non-reserved, non-colliding fallback (covers
   the existing local dedup logic, currently untested).
2. **Regression test (red first, pglite integration).** Boot a clean DB with one user;
   POST an `/api/sync` batch with two INSERTs — same `created_by`, same `slug`, different
   ids (the offline-two-devices scenario); assert BOTH rows end up in the DB (one keeps
   `slug = "groceries"`, the other gets a deterministic rename, e.g.
   `groceries-{nanoid(4)}`, matching the pattern `mergeUsers` already uses for the same
   collision); assert the response reports both ops as `applied` (neither `ignored`, no
   500). Test must fail against the current CTE.
3. **Fix server-side.** Have the CTE handle the `unique(created_by, slug)` collision by
   renaming the second list — an `ON CONFLICT (created_by, slug)` branch that appends a
   `nanoid(4)` suffix (mirror `mergeUsers`, see `mergeusers-transaction-lockdown`). The
   client's id is preserved.
4. **Client-side, optional and only if trivial.** Consider whether `createList` should
   also check beyond Dexie — probably not (the server is authoritative for cross-device
   collisions). Note the decision in the card.
5. Full suite green.

## Notes

- **Epic:** [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0**. Relates to
  [sync-no-stall-one-poison-op](sync-no-stall-one-poison-op.md): per-op isolation stops this
  collision from 500ing the whole batch, and returning the **server-renamed** slug lets the
  client learn its rename in one trip (which the Stage-1 [cursor delta](sync-cursor-delta-transport.md)
  depends on). Atoms: [sync-model](../knowledge/architecture/sync-model.md),
  [async-sync-testing](../knowledge/testing/async-sync-testing.md).
- Server-side rename is preferred over client-side because client-side doesn't help
  concurrent edits from different devices.
- See [sync-model](../knowledge/architecture/sync-model.md),
  [server-modules](../knowledge/architecture/server-modules.md),
  [client-modules](../knowledge/architecture/client-modules.md) for the create → queue →
  CTE path; [slug-routing](../knowledge/conventions/slug-routing.md) for the collision
  disambiguation scheme; [pglite](../knowledge/testing/pglite.md) +
  [fixtures](../knowledge/testing/fixtures.md) for the harness.
- Pairs with the low-priority `slugify`/`isReservedSlug`/`getEffectiveSlug` unit tests
  pooled in `low-priority-tests-from-audit` — fold them in if you touch slug logic here.
- `flags: [review]`: server CTE change; the collision-rename strategy is user-visible.
