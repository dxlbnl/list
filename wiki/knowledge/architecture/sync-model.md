---
title: Sync model — offline-first write path + realtime pull
type: mechanism
status: accepted
tags: [sync, offline-first, realtime, supabase, dexie, conflict-resolution, reconciliation, sync-queue, latency]
---

Offline-first. Every mutation goes through [actions.ts](client-modules.md): write Dexie immediately (optimistic, `liveQuery` re-renders), append a `SyncOperation` to `db.syncQueue`, then call `syncManager.processQueue()` at once. The `SyncManager` ([sync.svelte.ts](client-modules.md)) owns push + pull + reconnect.

**Push (egress).** `processQueue()` reads the *whole* queue and POSTs `{ operations, clientId }` to [`/api/sync`](server-modules.md), which applies every op in **one atomic CTE** (single DB round-trip) and returns `{ results: [{ id, status }] }`. Acked ops (`success` = written, `ignored` = rejected: unauthorized/stale-timestamp) are deleted from the queue by `localId`; a 400 drops the malformed batch, a 401/403 logs out. Concurrent flushes are coalesced via `pushPromise`; if items were queued mid-flush it reschedules in 100 ms. Pushes are **immediate**, not batched on a timer — the "10 s" cadence below is only a fallback.

**Pull (ingress) = Supabase Realtime, not SSE.** `connectSupabase(token)` sets the signed JWT ([supabase-auth](server-modules.md)) via `supabase.realtime.setAuth` and subscribes one channel to `postgres_changes` on `list_users`, `lists`, `items`. The changed row rides inline in `payload.new` (no extra fetch for a simple item/list upsert): membership change → `reconcileAllLists()`; `lists` upsert → `db.lists.put` (or reconcile if pending), delete → drop local list+items; `items` upsert → `db.items.put` **only if the list is active** (`activeListIds`), delete → drop local item.

**Conflict resolution.** A row whose id has a pending `syncQueue` op is **never overwritten** (`isOperationPending`) — the local in-flight version wins. Otherwise last-write-wins by `updated_at`: the server CTE only upserts an item when `EXCLUDED.updated_at > items.updated_at`. See [data-model](data-model.md).

**Reconnection / safety net.** A `startLoop()` runs `processQueue()` every ~10 s (10 s + jitter, exponential backoff to 2 min on error) and `reconcileAllLists()` every 6th pass (~1 min). Note the loop refreshes **list metadata only** — it never calls `pull()`, so a *missed item event* only reconverges on `online`/`visibilitychange`, not on the timer (see [sync-latency](sync-latency.md)). `window online` reconnects the channel and runs push + reconcile + `pull()` for all active lists; `visibilitychange→visible` reconciles. The Supabase JWT (1 h TTL) is refreshed 5 min before expiry via `GET /api/auth/token`, and on a `CHANNEL_ERROR`/expired-JWT.

**Why:** offline-first demands instant local writes and eventual server convergence. Batching all ops into one CTE keeps push to a single round-trip; Realtime (a Supabase websocket, independent of the Vercel ~300 s function cap that killed the old held-open SSE design) fans out changes; the poll/visibility/online layers backstop most missed events. But push and pull are **separate channels** and the timer never re-pulls items, so cross-device convergence can lag well past ~1 s — the redesign in [sync-redesign](sync-redesign.md) folds pull into the push response via a server cursor; see [sync-latency](sync-latency.md) for where the time goes.
