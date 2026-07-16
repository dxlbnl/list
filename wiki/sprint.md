# Sprint — current

> Goal + tasks + a **Next** pointer + an append-only run log. Resume from **Next**. At close: retro →
> learnings become atoms → archive to `wiki/sprint-archive/NNNN-slug.md`, then clear this file.

## Sprint goal

**Sync is correct and never stalls — proven by an async/timing test harness.** (Stage 0 of the
[sync overhaul](backlog/sync-single-roundtrip-overhaul.md); no schema change.)

## Tasks

Build the harness first (failing repros), then the fixes:

- [ ] [sync-async-test-harness](backlog/sync-async-test-harness.md) — two-client virtual-time harness; write **failing** repros first (resurrection, 20s stall, lost concurrent edit)
- [ ] [sync-apply-lww-guard](backlog/sync-apply-lww-guard.md) — row-level apply-iff-newer on Realtime + pull (fixes resurrection)
- [ ] [sync-no-stall-one-poison-op](backlog/sync-no-stall-one-poison-op.md) — kill the 20s backoff + poison-op wedge (client cadence + server per-op status)
- [ ] [sync-loop-reconverge-items](backlog/sync-loop-reconverge-items.md) — loop re-pulls items for active lists
- [ ] [sync-cte-insert-update-data-loss](backlog/sync-cte-insert-update-data-loss.md) — server: coalesce same-id INSERT+UPDATE
- [ ] [slug-collision-sync-batch-failure](backlog/slug-collision-sync-batch-failure.md) — server: per-op isolation + slug rename
- [ ] [sync-cte-upsert-lists-authz-hole](backlog/sync-cte-upsert-lists-authz-hole.md) — server: `created_by = user.id`

**Next:** Awaiting user go-ahead on this sprint composition. On approval → run the harness card first
(failing repros), then the fixes top-to-bottom.

Deferred to later sprints: **Stage 1** ([cursor transport](backlog/sync-cursor-delta-transport.md) +
[realtime-guarded-primary](backlog/sync-realtime-guarded-primary.md)) for the editor push-fold + backfill;
**Stage 2** ([fractional-index reorder](backlog/sync-fractional-index-reorder.md)). Per-field LWW: decided against.

## Run log

- 2026-07-16 — Composed sync-overhaul backlog (epic + 3 stages + async test harness). Design settled with
  user: **keep Realtime as the guarded data channel** (no nudge, no receive-side round-trip; the editor's
  push folds in the pull); **row-level LWW** enforced on both surfaces (per-field deferred); gift-list
  owner-blindness via **separate claim channels**, not server-filtered reads. Atoms updated: sync-redesign,
  sync-merge-model, sync-latency. Sprint 1 = Stage 0 + harness; awaiting go-ahead.
