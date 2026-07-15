---
title: Sync overhaul — converge in <1s, ideally one round-trip
type: feature
priority: high
flags: [review]
created: 2026-07-15
---

## What / why

Sync "isn't working well" and should feel instant — **a change should converge in under ~1s**, ideally
in a **single round-trip** from client to server. Research the current behaviour deeply first, then
redesign.

**Acceptance (target):**
- A local edit is durably persisted and its result observable to the editor within ~1s (already close —
  push is one CTE round-trip).
- A concurrent editor on another device sees the change within ~1s reliably (today this depends on the
  async Supabase Realtime echo or a ~10s+ fallback poll — the weak point).
- No wedged clients or silent drops under contention.

## Notes

Grounding (from the v2 distillation — read these first):
- [sync-model](../knowledge/architecture/sync-model.md) — the current push/pull split.
- [server-modules](../knowledge/architecture/server-modules.md) — the single-CTE `POST /api/sync`.
- [client-modules](../knowledge/architecture/client-modules.md) — the `SyncManager`.
- [data-model](../knowledge/architecture/data-model.md) — LWW-by-`updated_at`, soft delete.

Key finding to design against: **push and pull are separate channels.** `POST /api/sync` returns only
per-op *write status*, not other clients' changed rows, so a client cannot push-and-pull in one
round-trip today; convergence with concurrent writers rides the async Realtime echo (or the fallback
poll ~10s + jitter). The most promising direction: have `POST /api/sync` **also return the authoritative
rows changed since the client's cursor** (fold pull into the push response), reducing reliance on the
second Realtime/GET hop. Realtime then becomes the passive/idle-tab channel, not the critical path.

Related existing cards that this should absorb or coordinate with: [harness-pull-non-items-response](harness-pull-non-items-response.md),
[sync-cte-insert-update-data-loss](sync-cte-insert-update-data-loss.md), [slug-collision-sync-batch-failure](slug-collision-sync-batch-failure.md),
[sync-engine-invariant-safety-net](sync-engine-invariant-safety-net.md).

**First step:** a `researcher` deep-dive lands the current mechanics + a concrete redesign proposal as
knowledge atoms; this card then carries the chosen approach + acceptance tests.
