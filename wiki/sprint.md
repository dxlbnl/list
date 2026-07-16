# Sprint — current

> Goal + tasks + a **Next** pointer + an append-only run log. Resume from **Next**. At close: retro →
> learnings become atoms → archive to `wiki/sprint-archive/NNNN-slug.md`, then clear this file.

## Sprint goal

**The full sync rework in one sprint** — correct + **<1s single-round-trip** cross-device convergence.
All three stages of the [sync overhaul](backlog/sync-single-roundtrip-overhaul.md) ship together, validated
continuously against the async harness. Backbone: the `updated_seq` cursor + HLC LWW stamp (schema change);
the CTE is rewritten **once** incorporating every server-side change.

## Tasks (build order)

**Harness first — write the failing repros before any fix:**
- [ ] [sync-async-test-harness](backlog/sync-async-test-harness.md) — two-client virtual-time harness; repros: resurrection, 20s stall, data-loss, lost concurrent edit, cross-device <1s.

**Server — one coherent CTE rewrite on the new schema:**
- [ ] [sync-cursor-delta-transport](backlog/sync-cursor-delta-transport.md) — **backbone**: migration (`updated_seq` + HLC stamp on items/lists, `lists.updated_at`); `POST /api/sync` returns `{results, changes, cursor}`.
- [ ] [sync-cte-insert-update-data-loss](backlog/sync-cte-insert-update-data-loss.md) — coalesce same-id INSERT+UPDATE.
- [ ] [sync-cte-upsert-lists-authz-hole](backlog/sync-cte-upsert-lists-authz-hole.md) — force `created_by = user.id`.
- [ ] [slug-collision-sync-batch-failure](backlog/slug-collision-sync-batch-failure.md) — per-op isolation + auto-rename (`nanoid(4)` suffix).
- [ ] [sync-no-stall-one-poison-op](backlog/sync-no-stall-one-poison-op.md) — per-op status response (server) + short jittered backoff & poison-op quarantine (client).

**Client:**
- [ ] [sync-apply-lww-guard](backlog/sync-apply-lww-guard.md) — apply-iff-newer by HLC on Realtime + pull; self-echo suppression.
- [ ] [sync-realtime-guarded-primary](backlog/sync-realtime-guarded-primary.md) — keep Realtime inline (guarded + ordered); cursor delta = editor push-fold + backfill.
- [ ] [sync-loop-reconverge-items](backlog/sync-loop-reconverge-items.md) — the periodic loop does a cursor-backfill of active lists (absorbed into the new design).

**Ordering:**
- [ ] [sync-fractional-index-reorder](backlog/sync-fractional-index-reorder.md) — midpoint fractional-index reorder (kills the N-writes-per-drag amplifier).

**Invariant nets (build alongside the above):**
- [ ] [cte-invariant-safety-net](backlog/cte-invariant-safety-net.md) — server CTE invariants (pglite): LWW, soft-delete preservation, validator drop-undefined.
- [ ] [sync-engine-invariant-safety-net](backlog/sync-engine-invariant-safety-net.md) — client engine invariants: pending-wins, apply-guard, reconciliation.
- [ ] [harness-pull-non-items-response](backlog/harness-pull-non-items-response.md) — pull hardening.

**Next:** Awaiting go-ahead to start. On approval → build the harness + failing repros first, then work the
list top-to-bottom; the CTE-touching server cards land as a single rewrite. All review gates are cleared, so
the sprint interior runs autonomously until done, a real fork, or a blocker.

## Run log

- 2026-07-16 — Composed the sync overhaul (epic + cards + async harness). Design locked with user: **keep
  Realtime as the guarded data channel** (no nudge, no receive-side round-trip; editor push folds in the
  pull); **row-level LWW keyed on an HLC** (per-field decided against); gift-list owner-blindness via
  **separate claim channels**. All Sprint 1 review flags cleared.
- 2026-07-16 — Scope decision: do the **whole rework (Stages 0+1+2) in one sprint**, not staged across
  sprints. Sprint = all 13 sync cards; CTE rewritten once on the `updated_seq`/HLC backbone.
