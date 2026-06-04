---
id: B9
title: Wrap `mergeUsers` in a transaction + lockdown test (partial-failure leaves half-merged state)
type: chore
priority: high
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L10 + T5. `src/lib/server/auth.ts:73-135` (`mergeUsers`) runs
~5 distinct mutations (transfer lists, reassign list_users, rename
slug-colliding lists with `-{nanoid(4)}`, delete the anon user) as serial
`await db.update/.delete` calls **with no `db.transaction(...)` wrapper**.
A failure mid-merge — transient DB blip, FK cascade surprise, anything —
leaves a hybrid state: some lists transferred, some list_users reassigned,
anon user still alive. Next login retries from the partial state with
unpredictable results. Highest-blast-radius regression vector on login.

`mergeUsers` is also untested. We need a lock-down test that covers the
happy path AND a fault-injection variant proving the transaction wrap
rolls back cleanly.

## Acceptance (definition of done — tests-first chore)

1. **Lock-down test (red first, pglite integration).** A `pglite` test that:
   - seeds an anon source user with N lists (at least one whose `(slug)`
     collides with one of the target's slugs, plus a list_users membership);
   - seeds a verified target user;
   - calls `mergeUsers(sourceId, targetId)`;
   - asserts: all source lists are now owned by target; the colliding list's
     slug has the `-{nanoid(4)}` suffix; the list_users membership is
     reassigned; no FK orphans; the source user row is gone.
2. **Fault-injection variant (red first).** A second test that forces a
   failure mid-merge (e.g. monkey-patches the DB to throw on the third
   mutation) and asserts that **none** of the merge took effect (no lists
   transferred, no slugs renamed, anon user still alive, no half-merged
   state). This test must fail against the current code (no transaction →
   the earlier mutations persist).
3. **Wrap in transaction.** Refactor the function body to
   `db.transaction(async (tx) => { ... })`, threading `tx` through every
   call. Verify both tests pass.
4. **No behaviour change on happy path.** The lock-down test (1) must pass
   identically before and after the transaction wrap.
5. Full suite green.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` L10 + T5.
- This is a `chore` (not a `bug`) because the *symptom* hasn't been observed
  — we're hardening before it bites. Tests-first still applies because the
  fault-injection test must be red first to prove the wrap actually
  changes behaviour.
- `flags: [review]`: changes a load-bearing identity-merge path.
- Use the world from `src/lib/test/fixtures.ts` directly (D2 Rule).
