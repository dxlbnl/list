---
title: Add a last-write-wins guard to the client apply paths
type: bug
priority: high
flags: [review]
created: 2026-07-16
---

## What / why

**Repro:** delete an item — especially one created moments earlier — it vanishes locally,
then **reappears after the sync completes.** Reported by the user; matches the code exactly.
The same shape reverts *any* field (not just deletes) when a stale echo lands after an edit —
the delete case is just the visible one.

**Root cause.** The client's *apply* paths — the Realtime `items` handler
(`sync.svelte.ts:160-171`) and `pull()` (`sync.svelte.ts:362-373`) — do a full-row
`db.items.put` gated **only** by `isOperationPending(id)` (is there a queued op for this id?),
with **no staleness check**. Once a soft-delete op (an `UPDATE` carrying `deletedAt`) is acked
and removed from the queue, a later-arriving **stale** Realtime `INSERT`/`UPDATE` echo for that
id (e.g. the item's own creation echo, delayed by replication lag, carrying `deleted_at = null`)
is applied verbatim → `db.items.put({ …deletedAt: null })` → the item is resurrected. The
`[slug]` view filters `deletedAt === null`, so the resurrected row shows.

Two enabling facts: (1) Supabase Realtime does **not** guarantee cross-event ordering and
**echoes the originator's own writes** — `clientId` is sent to the server but never used to
suppress self-echo. (2) The **server CTE has an LWW guard**
(`WHERE items.updated_at < EXCLUDED.updated_at`, `+server.ts:104`) but the **client apply path
has none** — that asymmetry is the bug.

**Fix.** Before every `db.items.put` / `db.lists.put` in the apply paths, compare stamps and
**skip if the incoming server row is not newer than the local row** (row-level LWW by
`updatedAt`). This drops stale echoes, fixing both the delete-resurrection and the stale-field
reverts. Consider also suppressing self-echo by `clientId`. This is a **row-level** guard now;
per-field LWW-Map lands in Stage 2 ([sync-per-field-lww-map](sync-per-field-lww-map.md)); the
clean server-authoritative apply lands in Stage 1
([sync-cursor-delta-transport](sync-cursor-delta-transport.md)) — this bug is a strong argument
for both.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 0 (Stabilize)**. This
folds in the former `delete-item-resurrects-after-sync` card (report it for deletion).

Atoms: [sync-merge-model](../knowledge/architecture/sync-merge-model.md) (the asymmetry this
fixes), [sync-model](../knowledge/architecture/sync-model.md),
[sync-latency](../knowledge/architecture/sync-latency.md),
[soft-deletes](../knowledge/domain/soft-deletes.md). Tested via
[async-sync-testing](../knowledge/testing/async-sync-testing.md) — write the failing
reproduction ("a stale INSERT/UPDATE echo must not un-delete a locally soft-deleted item")
against the [async harness](sync-async-test-harness.md) first; add it to
[sync-engine-invariant-safety-net](sync-engine-invariant-safety-net.md).

`flags: [review]`: correctness change to a load-bearing client apply path.
</parameter>
