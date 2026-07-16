---
title: CTE invariant safety net — LWW, soft-delete preservation, validator drop-undefined
type: chore
priority: medium
flags: []
created: 2026-06-04
---

## What / why

The sync CTE on the server depends on three invariants currently uncovered by tests.
Locking them down keeps future changes (including the `sync-cte-insert-update-data-loss`,
`sync-cte-upsert-lists-authz-hole`, and `slug-collision-sync-batch-failure` fixes, which
all touch this SQL) from silently regressing them:

- **LWW (last-write-wins)** — a stale UPDATE (older `updated_at`) is ignored, not applied.
- **Soft-delete preservation** — a subsequent UPDATE that doesn't carry `deleted_at` does
  NOT un-delete the row. The CTE's `COALESCE` on `deleted_at` is the only thing keeping
  "tick done after delete" from restoring the item.
- **Validator drop-undefined** — `itemSyncDataSchema` and friends emit wire JSON with
  absent keys for undefined fields (not `null`), which is what the CTE's `data->>'key'`
  checks rely on. This is the foundation contract that the INSERT+UPDATE data-loss fix
  leans on.

None of these tests changes behaviour — they lock the contract. (Surfaced by the
test-coverage audit as findings T6 + T7 + T8.)

## Acceptance (chore, tests-first encouraged; tests are characterisation/lockdown)

1. **LWW (pglite).** Seed an item with `updated_at = T1`; send an UPDATE op with
   `updated_at = T0 < T1`; assert the row is unchanged and the op response is `ignored`.
2. **Soft-delete preservation (pglite).** Seed an item; UPDATE with `deleted_at = now`;
   UPDATE again with just `{ done: true }` (no `deleted_at` field); assert the row's
   `deleted_at` is still set (the COALESCE held).
3. **Validator drops undefined (node unit).** On `itemSyncDataSchema`, given a partial
   update (`{ id, done, updatedAt }`), assert the transformed wire object has no
   `list_id` / `name` / `rank` / `group_name` keys (not present, not `null`). Document the
   contract in a test comment.
4. Mark the tests as characterisation/lockdown in their names — they pass against current
   code.
5. Full suite green.

## Notes

- **Epic:** [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Testing**. Server CTE
  invariants via pglite, built alongside the [async test harness](sync-async-test-harness.md)
  (same pglite Postgres). Atoms: [async-sync-testing](../knowledge/testing/async-sync-testing.md),
  [pglite](../knowledge/testing/pglite.md).
- The validator drop-undefined contract is the one `sync-cte-insert-update-data-loss`
  relies on — either can land first; if that fix lands first, this verifies the validator
  side held.
- Consume the registered `zod4-mock` `world` from `src/lib/test/fixtures.ts` directly —
  see [fixtures](../knowledge/testing/fixtures.md).
- See [sync-model](../knowledge/architecture/sync-model.md) and
  [server-modules](../knowledge/architecture/server-modules.md) for the CTE;
  [soft-deletes](../knowledge/domain/soft-deletes.md) for the `deleted_at` semantics;
  [pglite](../knowledge/testing/pglite.md) for the harness.
