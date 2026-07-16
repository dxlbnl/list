---
title: Make the periodic loop reconverge items, not just list metadata
type: bug
priority: medium
flags: []
created: 2026-07-16
---

## What / why

The periodic `startLoop` reconciles list **metadata** only (`reconcileAllLists`) and **never
re-pulls items** — this is convergence hole #1 in
[sync-latency](../knowledge/architecture/sync-latency.md). `pull(listId)` (the only item
refresh) runs on subscribe, `online`, and pending-Realtime, **not** on the timer. So on a
device sitting with a list open, a **missed Realtime item event** does not heal until a
`focus`/`online` blip — the "poll backstops any missed event" story holds for lists, not items.

**Fix.** Make the loop reconverge items for the active lists (`activeListIds`) on its periodic
pass, so a missed item event self-heals on the timer. This is an **interim backstop**: the
Stage 1 cursor delta ([sync-cursor-delta-transport](sync-cursor-delta-transport.md)) supersedes
it by folding item pull into every push, at which point this coarse re-pull can be dropped or
demoted to a deep backstop.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0 (Stabilize)**, superseded
by Stage 1's cursor delta.

Atoms: [sync-latency](../knowledge/architecture/sync-latency.md) (hole #1),
[sync-model](../knowledge/architecture/sync-model.md). Apply pulled rows under the Stage-0
[apply-guard](sync-apply-lww-guard.md) so re-pulling can't revert newer local state.
</parameter>
