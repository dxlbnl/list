---
id: B12
title: CTE invariant safety net — lock down LWW, soft-delete preservation, and validator drop-undefined
type: chore
priority: medium
created: 2026-06-04
---

## Description

From B6 audit T6 + T7 + T8. The sync CTE on the server depends on three
invariants that are currently uncovered by tests:

- **LWW (last-write-wins)**: a stale `UPDATE` (older `updated_at`) is
  ignored, not applied (T6).
- **Soft-delete preservation**: a subsequent UPDATE that doesn't carry
  `deleted_at` does NOT un-delete the row (the CTE's `COALESCE` on
  `deleted_at` is the only thing keeping "tick done after delete" from
  restoring the item — T7, ties to R5).
- **Validator drop-undefined**: `itemSyncDataSchema` and friends emit wire
  JSON with absent keys for undefined fields (not `null`), which is what
  the CTE's `data->>'key'` checks rely on (T8). This is the foundation
  contract that B8's fix and B10's fix both lean on.

None of these tests changes behaviour — they lock the contract so future
changes (including the B8 + B10 + B11 fixes) can't accidentally regress
them.

## Acceptance (definition of done — chore, tests-first encouraged)

1. **T6 — LWW (pglite).** Seed an item with `updated_at = T1`; send an
   UPDATE op with `updated_at = T0 < T1`; assert the row is unchanged and
   the op response is `ignored`.
2. **T7 — soft-delete preservation (pglite).** Seed an item; UPDATE with
   `deleted_at = now`; UPDATE again with just `{ done: true }` (no
   `deleted_at` field); assert the row's `deleted_at` is still set (the
   COALESCE held).
3. **T8 — validator drops undefined (node unit).** On `itemSyncDataSchema`,
   given a partial update (`{ id, done, updatedAt }`), assert that the
   transformed wire object has no `list_id` / `name` / `rank` /
   `group_name` keys (not present, not `null`). Document the contract in a
   test comment.
4. Tests are characterisation/lockdown — they should pass against current
   code. Mark them as such in the test names.
5. Full suite green.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` T6, T7, T8.
- Coordinate with B8 (CTE INSERT+UPDATE fix) — T8 is the contract B8
  relies on; either can land first, but if B8 lands first, T8 verifies the
  validator side of the contract held.
- Use the world from `src/lib/test/fixtures.ts` directly (D2 Rule).
