---
title: Sync overhaul (epic) — correct, <1s, single round-trip
type: feature
priority: high
flags: []
created: 2026-07-15
---

## What / why

Sync is both **incorrect** and **slow** cross-device. Two symptom families:

- **Buggy cross-device merge.** A late or reordered server echo overwrites newer local
  state because the client apply path has **no last-write-wins guard** (only the server CTE
  does). This resurrects deleted items and reverts concurrent field edits.
- **20s+ stalls / wedged queues.** A thrown push falls to the ~10s loop whose first backoff
  is 20s; the atomic CTE 500s the *whole* batch on one bad op, so a single un-syncable op
  re-fails every 20/40s and blocks everything. Cross-device convergence also lags well past
  ~1s because push and pull are separate channels and the timer never re-pulls items.

**Target model** (three orthogonal pieces, each with its own atom):

- **Merge** — one symmetric **row-level LWW** applied *identically at every apply point*
  (server upsert + client Realtime apply + client pull), keyed on a comparable stamp, not raw
  wall-clock. Dexie becomes a real replica, not a dumb cache. Stamp = a **row-level HLC**; per-field
  LWW decided against. See [sync-merge-model](../knowledge/architecture/sync-merge-model.md).
- **Transport** — fold pull into the **editor's** push via a server-assigned monotonic cursor
  (`updated_seq`): `POST /api/sync` returns the rows changed since the caller's cursor, so one
  round-trip both persists and pulls (removes round-trips, doesn't add one). See
  [sync-redesign](../knowledge/architecture/sync-redesign.md).
- **Realtime stays the data channel** — peers keep receiving `payload.new` inline in one hop
  (no nudge, no receive-side round-trip), now **guarded** (apply-iff-newer) and **ordered**
  (`updated_seq`); the cursor delta is backfill-only. Gift-list per-viewer is solved by separate
  claim channels, not by routing reads server-side.

## Stages

This card is the **roadmap**; the stage cards below are the actionable work. The
[async test harness](sync-async-test-harness.md) is foundational and underpins all of it —
Stage 0 fixes are validated against it (write the failing reproductions first).

**Stage 0 — Stabilize** (no schema change; fixes the acute pain)
- [sync-apply-lww-guard](sync-apply-lww-guard.md) — row-level LWW guard on the client apply paths.
- [sync-no-stall-one-poison-op](sync-no-stall-one-poison-op.md) — kill the 20s stall + poison-op wedge.
- [sync-loop-reconverge-items](sync-loop-reconverge-items.md) — make the periodic loop re-pull items.
- [sync-cte-insert-update-data-loss](sync-cte-insert-update-data-loss.md) — server: coalesce same-id INSERT+UPDATE.
- [slug-collision-sync-batch-failure](slug-collision-sync-batch-failure.md) — server: per-op isolation + slug rename.
- [sync-cte-upsert-lists-authz-hole](sync-cte-upsert-lists-authz-hole.md) — server: `created_by = user.id` on INSERT.

**Stage 1 — Transport** (<1s, single round-trip)
- [sync-cursor-delta-transport](sync-cursor-delta-transport.md) — Design A: `updated_seq` cursor delta in the push response (and the HLC LWW stamp).
- [sync-realtime-guarded-primary](sync-realtime-guarded-primary.md) — keep Realtime inline, guarded + ordered; cursor as backfill.

**Stage 2 — Ordering**
- [sync-fractional-index-reorder](sync-fractional-index-reorder.md) — midpoint fractional-index reorder.

**Testing** (foundational, cross-cutting)
- [sync-async-test-harness](sync-async-test-harness.md) — two-client virtual-time harness with latency + error budgets.
- [sync-engine-invariant-safety-net](sync-engine-invariant-safety-net.md) — client-engine invariants, built on the harness.
- [cte-invariant-safety-net](cte-invariant-safety-net.md) — server CTE invariants via pglite, alongside the harness.
- [harness-pull-non-items-response](harness-pull-non-items-response.md) — pull hardening (relates to Stage 0/1).

## Notes

Grounding atoms (the source of truth — cards link here, don't restate):
[sync-model](../knowledge/architecture/sync-model.md) (current push/pull split),
[sync-latency](../knowledge/architecture/sync-latency.md) (the diagnosis),
[sync-redesign](../knowledge/architecture/sync-redesign.md) (the transport),
[sync-merge-model](../knowledge/architecture/sync-merge-model.md) (the merge),
[async-sync-testing](../knowledge/testing/async-sync-testing.md) (how it's tested).

**Three open decisions for the user** (surface in Stage 1 review): (1) cursor column
`updated_seq` sequence vs `updated_at`+id tie-break; (2) add the ~1s focused short-poll or
rely on the Realtime nudge alone; (3) cursor membership changes or keep them on reconcile.
</parameter>
</invoke>
