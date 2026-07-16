---
title: Testing the async/parallel sync engine — virtual time, two clients, budgets
type: pattern
status: draft
tags: [testing, sync, async, concurrency, timing, latency, virtual-time, fake-timers, realtime, error-injection, convergence]
---

Sync is concurrent and time-dependent, so it needs tests that **control time and simulate two clients** —
not just single-shot unit tests. The harness (built on [pglite](pglite.md) + [fixtures](fixtures.md), run in
the `server`/node tier per [test-setup](test-setup.md)) must give:

- **Two independent clients, one server.** Instantiate two `SyncManager` + two Dexie (`fake-indexeddb`)
  instances talking to a **single** pglite Postgres via the real `/api/sync` handler — this exercises the
  actual cross-device path ([sync-model](../architecture/sync-model.md)), not a mock.
- **Deterministic virtual time.** Drive the ~10s loop, backoff, short-poll, and JWT refresh with fake timers
  (`vi.useFakeTimers`) so tests are fast, deterministic, and can **assert timing** (advance the clock, assert
  what did/didn't happen). Never `sleep` on wall-clock.
- **A controllable transport.** A fake Realtime channel that can deliver echoes **delayed, reordered,
  duplicated, or dropped**, and a controllable `/api/sync` fetch — to reproduce the real failure modes
  (stale-echo resurrection, missed events) instead of hoping they don't happen.
- **Latency-budget assertions.** After client A commits, client B **converges within a budget** (e.g. <1s of
  virtual time) — encode the product requirement as a test, not a hope.
- **Error-does-not-stall assertions.** Inject a failing op / 500 / offline blip and assert: other ops still
  sync, the retry happens within a **bounded** delay (no 20s backoff cliff — see [sync-latency](../architecture/sync-latency.md)),
  and one poison op never wedges the queue.
- **Convergence/invariant properties.** After quiescence both replicas are byte-equal; a delete stays deleted
  through reordered echoes; concurrent different-field edits both survive (per-field [merge](../architecture/sync-merge-model.md)).

**Why:** the sync bugs (resurrection, 20s stalls, lost concurrent edits) are all **timing/ordering/error**
bugs that single-threaded happy-path tests can't catch — they only appear under interleaving and failure. A
harness that makes time and delivery **deterministic inputs** turns those into ordinary, repeatable
assertions, and lets the `<1s` and "errors don't cause long delays" requirements be *enforced* by CI.
