---
title: Async/parallel/timing sync test harness (two clients, virtual time, budgets)
type: feature
priority: high
flags: []
created: 2026-07-16
---

## What / why

Build the async/parallel/timing test harness per
[async-sync-testing](../knowledge/testing/async-sync-testing.md). This is the **FOUNDATION** of
the whole overhaul: the sync bugs (resurrection, 20s stall, lost concurrent edit) are all
timing/ordering/error bugs that single-threaded happy-path tests can't catch. Make time and
delivery **deterministic inputs** so those become ordinary, repeatable assertions.

**The harness provides:**
- **Two independent clients, one server.** Two `SyncManager` + two Dexie (`fake-indexeddb`)
  instances against **one** pglite Postgres via the **real** `/api/sync` handler — the actual
  cross-device path, not a mock.
- **Deterministic virtual time.** `vi.useFakeTimers` driving the loop, backoff, short-poll, and
  JWT refresh — assert timing by advancing the clock; never sleep on wall-clock.
- **A controllable transport.** A fake Realtime channel that can **delay / reorder / duplicate /
  drop** echoes, and a controllable `/api/sync` fetch — to reproduce the real failure modes.
- **Latency-budget assertions.** After A commits, B **converges within <1s virtual**.
- **Error-injection with bounded-delay assertions.** An op 500 / offline blip must not stall
  past budget — **no 20s cliff, no queue wedge**; other ops still sync.
- **Convergence / invariant properties.** Byte-equal replicas after quiescence; a delete stays
  deleted through reordered echoes; concurrent different-field edits both survive.

**Write the failing reproductions first** (they drive the Stage-0 fixes): the resurrection
(un-delete via stale echo), the 20s stall / poison-op wedge, and the lost concurrent edit.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Testing (foundational,
cross-cutting)**. Stage-0 fixes ([apply-guard](sync-apply-lww-guard.md),
[no-stall](sync-no-stall-one-poison-op.md)) are validated against it; it enables the two
invariant suites ([sync-engine-invariant-safety-net](sync-engine-invariant-safety-net.md),
[cte-invariant-safety-net](cte-invariant-safety-net.md)).

Atoms: [async-sync-testing](../knowledge/testing/async-sync-testing.md) (the pattern),
[pglite](../knowledge/testing/pglite.md) (the in-process Postgres),
[fixtures](../knowledge/testing/fixtures.md) (the zod4-mock world),
[test-setup](../knowledge/testing/test-setup.md) (the server/node tier),
[sync-model](../knowledge/architecture/sync-model.md) (the path under test).

**Approved 2026-07-16** — cleared for Sprint 1: build first, TDD the Stage-0 fixes against it.
</parameter>
