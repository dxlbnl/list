---
id: B11
title: Concurrent list-create on two devices (same user + slug) aborts the entire sync batch — user permanently stuck
type: bug
priority: high
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L5 (confirmed by reading code, needs-reproduction on the
exact Postgres CTE error semantics). `src/lib/client/actions.ts:9-13`
(`createList`) only checks the **local** Dexie for slug collisions before
assigning a slug. Realistic scenario: user is offline on two devices, both
create a "groceries" list for the same logged-in user → both assign slug
"groceries" locally → both queue INSERT ops with different ids but the
same `(created_by, slug)` → device #1 reconnects, flushes, server inserts
row #1 → device #2 reconnects, flushes, server tries INSERT row #2 → the
`UNIQUE(created_by, slug)` constraint (`schema.ts:40`) violates. The CTE's
`ON CONFLICT (id) DO UPDATE` only catches PK conflicts, not other unique
constraints. The transaction errors out; the catch in `+server.ts:145-149`
re-throws as a 500; the client (`processQueue` line 273-277) sets
`lastSyncError` and **leaves the queue intact**. The user is permanently
stuck — every subsequent flush fails identically until they manually clear
local state.

## Acceptance (definition of done — `bug` track: tests-first)

1. **Foundation test (red, node + fake-indexeddb).** A unit test on
   `actions.ts:createList` that verifies the local slug-collision branch
   picks a non-reserved, non-colliding fallback (covers the existing local
   dedup logic; not currently tested).
2. **Regression test (red first, pglite integration).** A `pglite` test
   that:
   - boots a clean DB with one user;
   - POSTs an `/api/sync` batch with two INSERTs: same `created_by`, same
     `slug`, different ids (the offline-two-devices scenario);
   - asserts BOTH rows end up in the DB — one keeps `slug = "groceries"`,
     the other gets a deterministic rename (e.g. `groceries-{nanoid(4)}`,
     matching what `mergeUsers` already does for the same kind of
     collision);
   - asserts the response reports both ops as `applied` (neither `ignored`,
     no 500).

   Test must fail against the current CTE.
3. **Fix server-side.** Have the CTE handle `unique(created_by, slug)`
   collision by renaming the second list — `ON CONFLICT (created_by, slug)`
   branch that appends a `nanoid(4)` suffix (mirror the pattern in
   `mergeUsers`). The client's id is preserved.
4. **Client-side, optional and only if trivial.** Consider whether
   `actions.ts:createList` should also check beyond Dexie — probably not
   (the server is authoritative for cross-device collisions). Note the
   decision in the spec.
5. Full suite green.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` L5 + T9 + T10.
- `flags: [review]`: server CTE change; collision rename strategy is a
  user-visible behaviour and worth approval before tests/impl.
- The audit explicitly recommends server-side rename over client-side
  because client-side doesn't help concurrent edits from different devices.
