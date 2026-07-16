---
title: Wrap mergeUsers in a transaction + lock-down test
type: chore
priority: high
flags: [review]
created: 2026-06-04
---

## What / why

`src/lib/server/auth.ts` `mergeUsers` runs ~5 distinct mutations (transfer lists,
reassign list_users, rename slug-colliding lists with a `-{nanoid(4)}` suffix, delete the
anon user) as serial `await db.update/.delete` calls **with no `db.transaction(...)`
wrapper**. A failure mid-merge — transient DB blip, FK cascade surprise, anything — leaves
a hybrid state: some lists transferred, some list_users reassigned, anon user still alive.
The next login retries from that partial state with unpredictable results. It's the
highest-blast-radius regression vector on login, and `mergeUsers` is currently untested.

Filed as a `chore` (not a `bug`) because the symptom hasn't been observed — we're
hardening before it bites. Tests-first still applies: the fault-injection test must be red
first to prove the transaction wrap actually changes behaviour. (Surfaced by the
test-coverage audit as findings L10 + T5.)

## Acceptance (tests-first chore)

1. **Lock-down test (red first, pglite integration).** Seed an anon source user with N
   lists (at least one whose slug collides with one of the target's slugs, plus a
   list_users membership) and a verified target user; call `mergeUsers(sourceId,
   targetId)`; assert: all source lists are now owned by target; the colliding list's slug
   has the `-{nanoid(4)}` suffix; the list_users membership is reassigned; no FK orphans;
   the source user row is gone.
2. **Fault-injection variant (red first).** Force a failure mid-merge (e.g. monkey-patch
   the DB to throw on the third mutation) and assert that **none** of the merge took effect
   (no lists transferred, no slugs renamed, anon user still alive, no half-merged state).
   This must fail against the current code (no transaction → the earlier mutations persist).
3. **Wrap in transaction.** Refactor the body to `db.transaction(async (tx) => { ... })`,
   threading `tx` through every call. Both tests pass.
4. **No behaviour change on happy path.** The lock-down test (1) passes identically before
   and after the wrap.
5. Full suite green.

## Notes

- Consume the registered `zod4-mock` `world` from `src/lib/test/fixtures.ts` directly —
  see [fixtures](../knowledge/testing/fixtures.md) and
  [the-rules](../knowledge/project/the-rules.md).
- Identity-merge path lives in [server-modules](../knowledge/architecture/server-modules.md);
  account merge behaviour in [auth](../knowledge/domain/auth.md);
  integration harness in [pglite](../knowledge/testing/pglite.md).
- The slug-rename-on-collision pattern here is the same one
  `slug-collision-sync-batch-failure` proposes mirroring server-side in the CTE.
- `flags: [review]`: changes a load-bearing identity-merge path.
