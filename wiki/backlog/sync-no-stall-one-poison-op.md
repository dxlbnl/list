---
title: Kill the 20s+ stall and one-poison-op queue wedging
type: bug
priority: high
flags: []
created: 2026-07-16
---

## What / why

A healthy push is immediate (one CTE round-trip), but on **any** failure the queue stalls for
20s+ and one un-syncable op can wedge everything.

**Root cause** (see [sync-latency](../knowledge/architecture/sync-latency.md)): `startLoop`
base is 10s and the first backoff is `min(10000*2, 120000)` = **20s** (`sync.svelte.ts:212`).
When a push *throws* (a 500 from a poison op, a transient Neon error, an offline blip) the
immediate path gives up and the *only* retry is the loop, now ~20s (then 40s…) out. And the CTE
batch is **atomic**: one un-syncable op (e.g. `slug-collision-sync-batch-failure`) 500s the
*whole* batch, so a single bad op re-fails every 20/40s and blocks all other queued changes.

**Fix (three parts):**
- **(a) client — decouple healthy cadence from error handling.** A short ~1–2s base with small
  jittered *incremental* backoff (not the 10s→20s→40s cliff); retry promptly after a failure.
- **(b) client — quarantine poison ops.** After N consecutive failures, set an op aside so it
  can't wedge the queue and other ops keep flowing.
- **(c) server — per-op status.** `/api/sync` returns per-op status (incl. errors) instead of
  500ing the entire batch, so one bad op is isolated at the source.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0 (Stabilize)**. Part (c)
(per-op isolation) is the server side of [slug-collision-sync-batch-failure](slug-collision-sync-batch-failure.md)
— coordinate so both land the per-op-status contract once.

Atoms: [sync-latency](../knowledge/architecture/sync-latency.md) (the backoff-cliff diagnosis),
[async-sync-testing](../knowledge/testing/async-sync-testing.md) (error-does-not-stall budgets),
[sync-model](../knowledge/architecture/sync-model.md). Validate against the
[async harness](sync-async-test-harness.md): inject a 500 / offline blip and assert the retry
happens within a bounded delay (no 20s cliff) and one poison op never wedges the queue.

**Approved 2026-07-16** — cleared for Sprint 1: per-op error response contract approved.
</parameter>
