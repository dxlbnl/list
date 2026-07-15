---
title: Sync latency — where convergence time actually goes today
type: reference
status: accepted
tags: [sync, latency, convergence, realtime, round-trip, poll, reconcile, reorder, diagnosis]
---

Measured against the code ([sync-model](sync-model.md), [server-modules](server-modules.md),
[client-modules](client-modules.md)). The **editor's own** device is already fast: the Dexie write is
optimistic (instant) and `processQueue()` is **one** `POST /api/sync` round-trip (network RTT + one CTE
exec, logged as `tTotal`). The problem is **cross-device** convergence.

**A peer sees a change via one of three channels, none guaranteed <1s:**
- **Supabase Realtime `postgres_changes`** — the fast path when it works, but its latency is Postgres
  commit → logical-replication/WAL decode → Realtime server → websocket, typically ~100ms–1s+ and
  **variable/unreliable** (CHANNEL_ERROR, the 1h JWT-refresh window, silent drops). The changed row rides
  inline in `payload.new`.
- **GET reconcile / pull fallbacks** — `reconcileAllLists()` (GET `/api/lists`) and `pull(listId)`
  (GET `/api/lists/[id]`) are **full-table fetches, not deltas** (O(list size)), fired on
  `visibilitychange`, `online`, subscribe, and periodically.
- **The 10s `startLoop`** — `processQueue()` every ~10s (+≤2s jitter, exp-backoff to 2min on error);
  reconcile every 6th pass (~1min).

**Two concrete convergence holes:**
1. **The periodic loop never re-pulls items.** `startLoop` calls `processQueue` (push) + `reconcileAllLists`
   (list *metadata* only — it never touches `items`). `pull(listId)` (the only item refresh) runs on
   subscribe, `online`, and pending-Realtime — **not** on the timer. So on a device sitting with a list
   open, if a Realtime item event is missed, the peer's item edit does **not** reconverge until a
   `visibilitychange`/`online` blip. The "poll backstops any missed event" story holds for lists, not items.
2. **Separate push/pull channels.** `POST /api/sync` returns only per-op write status, never other
   clients' rows, so no single trip both persists and pulls; cross-device change always needs the second
   (Realtime or GET) hop.

**Payload amplifier:** the reorder handler (`[slug]/+page.svelte` `handleDndFinalize`) **full-renumbers**
(`rank: index` for every shifted item) instead of a midpoint insert, so one drag emits up to N item
UPDATEs → N row writes → **N Realtime echoes** and N cursor bumps for a single gesture. See
[lists](../domain/lists.md) and the `reorder-design-midpoint-vs-renumber` card.

**Why:** naming the exact hops shows the fix is not "make Realtime faster" but "remove the second hop and
the timer gap" — fold the pull into the push response and refresh items on a cursor, per
[sync-redesign](sync-redesign.md).
