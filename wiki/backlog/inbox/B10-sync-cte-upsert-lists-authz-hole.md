---
id: B10
title: Sync CTE authz: client can INSERT a list with arbitrary `created_by`
type: bug
priority: medium
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L2 (confirmed by reading code). In
`src/routes/api/sync/+server.ts:64-72` (the `upsert_lists` step), the WHERE
clause is:

```sql
NOT EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id)
OR EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id AND l.created_by = ${user.id})
```

For a **new** id (no existing row), `NOT EXISTS` is true and the INSERT
proceeds regardless of what `created_by` value the client sent. A
client/attacker can therefore INSERT a list "owned by" any user id. The
follow-up `upsert_members` step inserts `(list_id, current_user)` for each
input list, so the attacker becomes a member of the spoofed list — but the
fake owner does not, so the fake owner cannot see it on their dashboard.
Damage is limited to data pollution (the attacker can clutter the DB with
attributable-to-others lists), not victim impersonation.

Still a real authz gap — the client should not be able to claim ownership
of arbitrary user ids.

## Acceptance (definition of done — `bug` track: tests-first)

1. **Regression test (red first, pglite integration).** A `pglite` test
   that:
   - boots a clean DB with two users (attacker + victim);
   - POSTs an `/api/sync` batch as the attacker containing an INSERT for a
     new list with `created_by: victim.id`;
   - asserts the resulting `lists` row's `created_by` equals the **attacker's**
     id (or that the INSERT was rejected entirely — spec-writer's call).

   Test must fail against the current CTE.
2. **Fix.** Enforce `created_by = ${user.id}` in the INSERT path —
   `WHERE NOT EXISTS (...) AND d.created_by = ${user.id}` (rejects mis-attributed
   inserts) OR, cleaner, ignore the client-supplied `created_by` for INSERT
   and substitute `${user.id}` directly in the SELECT. Spec-writer to pick.
3. **No regression on legitimate path.** The owner's own INSERTs still
   succeed; existing list UPDATEs still gate on
   `l.created_by = ${user.id}`.
4. Full suite green.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` L2 + T2.
- `flags: [review]`: authz change to a load-bearing endpoint.
- Pair with B12's CTE invariant net (T6/T7/T8) — they share the same SQL.
