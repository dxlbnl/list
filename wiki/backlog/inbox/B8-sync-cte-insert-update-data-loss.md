---
id: B8
title: Sync CTE silently drops items when INSERT + UPDATE for the same id batch together (data loss)
type: bug
priority: high
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L1 (confirmed by reading code). When `addItem` is immediately
followed by `toggleDone` (or any UPDATE) before the first sync flush, both
ops go into the next `/api/sync` batch with the same id. The server CTE
de-dupes with `DISTINCT ON (id) ORDER BY id, updated_at DESC`, keeping only
the later UPDATE — which carries only the changed fields (no `list_id`,
`name`, `rank`). The downstream LEFT JOIN + WHERE filters that partial
record out as "no existing row to update", both ops are reported `ignored`,
the client drops both from `db.syncQueue` on the ack, and the item is
**permanently lost server-side**. Local Dexie still shows it until the next
`reconcileAllLists` overwrites local state with server's (empty)
authoritative view — at which point the item silently disappears from the
user's own screen with no explanation.

## Acceptance (definition of done — `bug` track: tests-first)

1. **Regression test (red first, pglite integration).** A `pglite` test that:
   - boots a clean DB;
   - simulates the scenario by POSTing an `/api/sync` batch containing an
     INSERT op + an UPDATE op for the same item id (the UPDATE carries only
     `done: true` + the changed `updated_at`);
   - asserts the `items` table contains a row with the INSERT's
     `list_id`/`name`/`rank` and the UPDATE's `done: true`;
   - asserts neither op is reported `ignored`.

   This test must fail against the current CTE.
2. **Fix server-side** (audit's recommended option 1): in
   `src/routes/api/sync/+server.ts`, change the dedup step so a same-id
   INSERT+UPDATE batch coalesces into one record that takes mandatory fields
   from the INSERT and mutable fields from the latest UPDATE. The cleanest
   shape is a `jsonb_object_agg` (or equivalent) step that merges all ops for
   the same id, last-write-wins per field, never overwriting a non-null field
   with null. Spec-writer to verify exact SQL shape against pglite/Postgres.
3. **No regression in conflict resolution.** Existing LWW behaviour
   (UPDATE-only batches, multi-device updates) keeps working. Pair with the
   T6/T7 invariant tests (B12) when those land.
4. Full suite green (`pnpm test`, `pnpm check`, `pnpm lint`).

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` L1 + T1.
- Pair: T8 (validator drops-undefined unit test) is in B12; it documents the
  contract the CTE fix relies on.
- `flags: [review]`: changes load-bearing server SQL — pause for approval of
  the spec before tests/impl.
