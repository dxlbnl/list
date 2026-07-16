---
title: Sync model — offline-first write path + cursor delta + realtime
type: mechanism
status: accepted
tags: [sync, offline-first, realtime, supabase, dexie, conflict-resolution, cursor, reconciliation, sync-queue, latency, hlc]
---

Offline-first. Every mutation goes through [actions.ts](client-modules.md): write Dexie immediately (optimistic, `liveQuery` re-renders), stamp `updatedAt` with the [HLC](sync-merge-model.md), append a `SyncOperation` to `db.syncQueue`, then call `processQueue()` at once. The `SyncManager` ([sync.svelte.ts](client-modules.md)) owns push + pull + reconnect; its Dexie and `fetch` deps are injectable for the [test harness](../testing/async-sync-testing.md).

**Push = one round-trip that also pulls.** `processQueue()` POSTs `{ operations, clientId, cursor }` to [`/api/sync`](server-modules.md), which applies every op in **one atomic CTE** and returns `{ results, changes, cursor }`: `results` = per-op `success`/`ignored`; `changes` = the member-visible rows changed since the caller's `cursor` (`updated_seq`); `cursor` = the new high-water mark. So the editor's push both persists **and** pulls — no separate pull. Acked ops are removed by `localId`; a 400 drops the malformed batch, 401/403 logs out; concurrent flushes coalesce via `pushPromise`. `pullDelta()` is the idle/backfill form (empty ops + cursor).

**Realtime = a peer's data pushed in one hop.** `connectSupabase(token)` subscribes one channel to `postgres_changes` on `list_users`, `lists`, `items`; a peer's changed row rides inline in `payload.new` and is applied through the **guarded** [`applyServerItem`](sync-merge-model.md). Membership change → `reconcileWithServerLists`. Realtime is the fast nudge-with-data, not the source of truth — the cursor delta backfills any missed/dropped event.

**Conflict resolution — one guarded apply on both surfaces.** A row with a pending `syncQueue` op is never overwritten (`isOperationPending`, keyed on `data.id`, not the op's own id). Otherwise **row-level LWW**: the client applies a server row only if it is strictly newer (`applyServerItem`), and the server CTE upserts an item only when `EXCLUDED.updated_at > items.updated_at`. Stamps are [HLC](sync-merge-model.md) so a skewed clock can't win. This kills the stale-echo / delete-resurrection class.

**Loop / reconnect.** `startLoop()` runs `processQueue()` + `pullDelta()` every ~2 s (gentle jittered backoff capped at 30 s on error — no 20 s cliff; a batch that fails 5× is quarantined) and `reconcileAllLists()` ~every 60 s (the authoritative list set). `online`/`visibilitychange` also push + reconcile + `pullDelta`. The Supabase JWT (1 h) refreshes 5 min before expiry and on `CHANNEL_ERROR`.

**Split.** Cursor delta = item upserts + list renames; reconcile (`GET /api/lists`) = list membership + hard list-deletes (a deleted row can't satisfy `updated_seq > cursor`). Soft item-deletes flow through the delta as rows with `deleted_at` set.

**Why:** offline-first demands instant local writes and fast, *correct* convergence. Folding pull into the push response makes the editor's round-trip do double duty; Realtime still pushes peers' data in one hop (guarded); the cursor delta backfills gaps and the HLC-keyed guard makes the merge order-independent. Rationale: [sync-redesign](sync-redesign.md), [sync-merge-model](sync-merge-model.md); the old flow's diagnosis: [sync-latency](sync-latency.md).
