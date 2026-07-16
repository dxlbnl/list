---
title: Sync CTE drops items when INSERT + UPDATE for the same id batch together
type: bug
priority: high
flags: []
created: 2026-06-04
---

## What / why

**Data loss.** When `addItem` is immediately followed by `toggleDone` (or any UPDATE)
before the first sync flush, both ops go into the next `/api/sync` batch with the same
id. The server CTE de-dupes with `DISTINCT ON (id) ORDER BY id, updated_at DESC`, keeping
only the later UPDATE — which carries only the changed fields (no `list_id`, `name`,
`rank`). The downstream LEFT JOIN + WHERE filters that partial record out as "no existing
row to update", both ops are reported `ignored`, the client drops both from
`db.syncQueue` on the ack, and the item is **permanently lost server-side**. Local Dexie
still shows it until the next `reconcileAllLists` overwrites local state with the server's
(empty) authoritative view — at which point the item silently disappears from the user's
own screen with no explanation.

Confirmed by reading the code (surfaced by the test-coverage audit as finding L1).

## Acceptance (bug track — tests-first)

1. **Regression test (red first, pglite integration).** A pglite test that:
   - boots a clean DB;
   - POSTs an `/api/sync` batch containing an INSERT op + an UPDATE op for the same item
     id (the UPDATE carries only `done: true` + the changed `updated_at`);
   - asserts the `items` table contains a row with the INSERT's `list_id`/`name`/`rank`
     and the UPDATE's `done: true`;
   - asserts neither op is reported `ignored`.

   This test must fail against the current CTE.
2. **Fix server-side.** In `src/routes/api/sync/+server.ts`, change the dedup step so a
   same-id INSERT+UPDATE batch coalesces into one record taking mandatory fields from the
   INSERT and mutable fields from the latest UPDATE. Cleanest shape is a `jsonb_object_agg`
   (or equivalent) step that merges all ops for the same id, last-write-wins per field,
   never overwriting a non-null field with null. Verify exact SQL shape against
   pglite/Postgres.
3. **No regression in conflict resolution.** Existing LWW behaviour (UPDATE-only batches,
   multi-device updates) keeps working — pairs with the LWW + soft-delete invariant tests
   in `cte-invariant-safety-net`.
4. Full suite green (`pnpm test`, `pnpm check`, `pnpm lint`).

## Notes

- **Epic:** [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0** (server
  correctness). The [async harness](sync-async-test-harness.md) +
  [cte-invariant-safety-net](cte-invariant-safety-net.md) cover this fix; the Stage-1
  [cursor delta](sync-cursor-delta-transport.md) `SELECT` inherits the coalesce, so it must not
  regress. Atoms: [sync-model](../knowledge/architecture/sync-model.md),
  [server-modules](../knowledge/architecture/server-modules.md),
  [async-sync-testing](../knowledge/testing/async-sync-testing.md).
- Depends on the validator drop-undefined contract (absent keys, not `null`) that
  `cte-invariant-safety-net` locks down — the CTE fix leans on it.
- See [sync-model](../knowledge/architecture/sync-model.md) and
  [server-modules](../knowledge/architecture/server-modules.md) for the batch-push + CTE
  design; [pglite](../knowledge/testing/pglite.md) and
  [fixtures](../knowledge/testing/fixtures.md) for the integration harness.
- **Approved 2026-07-16** — cleared for Sprint 1.
