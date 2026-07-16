---
title: Keep Realtime as the guarded data channel (not a nudge)
type: feature
priority: medium
flags: []
created: 2026-07-16
---

## What / why

Realtime stays the **data-carrying** push channel — peers keep receiving `payload.new` inline in one hop
(the Vercel-compatible SSE replacement), **not** nudge-then-pull (that adds a receive-side round-trip the
user won't pay). Fix it, don't demote it:
- Apply `payload.new` only under the [apply-guard](sync-apply-lww-guard.md) (apply-iff-newer by row stamp),
  so a stale/reordered echo can't overwrite newer local state.
- Order/compare by `updated_seq` (from [cursor transport](sync-cursor-delta-transport.md)).
- Use the cursor delta as **backfill only** — on reconnect / missed event / cold start — never a
  steady-state pull.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 1 (Transport)**. Depends on
[sync-apply-lww-guard](sync-apply-lww-guard.md) + [sync-cursor-delta-transport](sync-cursor-delta-transport.md).

Atoms: [sync-redesign](../knowledge/architecture/sync-redesign.md) (keep-primary + backfill),
[sync-model](../knowledge/architecture/sync-model.md). Per-viewer/gift-list filtering is handled by
**separate claim channels** (see [gift-lists](gift-lists-owner-blind-claims.md)), not by routing reads
server-side. Validate against the [async harness](sync-async-test-harness.md): dropped/reordered/duplicated
echoes still converge and never resurrect.
