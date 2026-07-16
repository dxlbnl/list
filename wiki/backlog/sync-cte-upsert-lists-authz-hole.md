---
title: Sync CTE authz — client can INSERT a list with arbitrary created_by
type: bug
priority: medium
flags: []
created: 2026-06-04
---

## What / why

In `src/routes/api/sync/+server.ts` (the `upsert_lists` step), the WHERE clause is:

```sql
NOT EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id)
OR EXISTS (SELECT 1 FROM lists l WHERE l.id = d.id AND l.created_by = ${user.id})
```

For a **new** id (no existing row), `NOT EXISTS` is true and the INSERT proceeds
regardless of what `created_by` value the client sent. A client/attacker can therefore
INSERT a list "owned by" any user id. The follow-up `upsert_members` step inserts
`(list_id, current_user)` for each input list, so the attacker becomes a member of the
spoofed list — but the fake owner does not, so the fake owner can't see it on their
dashboard. Damage is limited to data pollution (cluttering the DB with
attributable-to-others lists), not victim impersonation. Still a real authz gap — the
client should not be able to claim ownership of arbitrary user ids.

Confirmed by reading the code (surfaced by the test-coverage audit as finding L2).

## Acceptance (bug track — tests-first)

1. **Regression test (red first, pglite integration).** Boot a clean DB with two users
   (attacker + victim); POST an `/api/sync` batch as the attacker containing an INSERT for
   a new list with `created_by: victim.id`; assert the resulting `lists` row's `created_by`
   equals the **attacker's** id (or that the INSERT was rejected entirely — implementer's
   call). Test must fail against the current CTE.
2. **Fix.** Enforce `created_by = ${user.id}` on the INSERT path —
   `WHERE NOT EXISTS (...) AND d.created_by = ${user.id}` (rejects mis-attributed inserts)
   OR, cleaner, ignore the client-supplied `created_by` for INSERT and substitute
   `${user.id}` directly in the SELECT.
3. **No regression on the legitimate path.** The owner's own INSERTs still succeed;
   existing list UPDATEs still gate on `l.created_by = ${user.id}`.
4. Full suite green.

## Notes

- **Epic:** [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0/1** (server authz).
  The `created_by = user.id` INSERT fix is a hard requirement the Stage-1
  [cursor delta](sync-cursor-delta-transport.md) `SELECT` also relies on (member-visible
  filtering). Atoms: [server-modules](../knowledge/architecture/server-modules.md),
  [async-sync-testing](../knowledge/testing/async-sync-testing.md).
- Shares the same SQL as `cte-invariant-safety-net` (LWW / soft-delete / validator
  invariants) — coordinate so the invariant net covers this change.
- See [sync-model](../knowledge/architecture/sync-model.md) and
  [server-modules](../knowledge/architecture/server-modules.md) for the CTE + authz model;
  [pglite](../knowledge/testing/pglite.md) for the harness.
- **Approved 2026-07-16** — cleared for Sprint 1.
