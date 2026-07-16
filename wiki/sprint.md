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
- [x] **sync-cte-insert-update-data-loss** — coalesce same-id INSERT+UPDATE ✅ (fix + pglite regression green).
- [x] **sync-cte-upsert-lists-authz-hole** — force `created_by = user.id` ✅ (fix + pglite regression).
- [x] **slug-collision-sync-batch-failure** — server auto-rename on `(user,slug)` collision ✅ (fix + pglite regression). Per-op isolation lands with no-stall; client learns the new slug via the cursor delta.
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

**Next:** the `updated_seq`/HLC schema backbone + cursor delta (`sync-cursor-delta-transport`), then the
two-client harness for the client-side cards (apply-guard, realtime, no-stall, loop, reorder).

## Run log

- 2026-07-16 — Composed the sync overhaul (epic + cards + async harness). Design locked with user: **keep
  Realtime as the guarded data channel** (no nudge, no receive-side round-trip; editor push folds in the
  pull); **row-level LWW keyed on an HLC** (per-field decided against); gift-list owner-blindness via
  **separate claim channels**. All Sprint 1 review flags cleared.
- 2026-07-16 — Scope decision: do the **whole rework (Stages 0+1+2) in one sprint**, not staged across
  sprints. Sprint = all 13 sync cards; CTE rewritten once on the `updated_seq`/HLC backbone.
- 2026-07-16 — **Started.** Extracted the sync CTE into `src/lib/server/sync.ts`
  `processSyncBatch(db, userId, ops)` (pglite-testable; the `/api/sync` endpoint is now a thin wrapper).
  Closed `sync-cte-insert-update-data-loss`: same-id INSERT+UPDATE now coalesce per-field (latest non-null
  wins) — red repro → green; `pnpm test`/`check`/`lint` all pass.
- 2026-07-16 — Closed `sync-cte-upsert-lists-authz-hole`: list INSERT now forces `created_by = user.id`
  (client-supplied value ignored) — red repro → green.
- 2026-07-16 — Closed `slug-collision-sync-batch-failure`: the CTE renames a colliding `(created_by, slug)`
  (in-batch dupe or already-owned) with an id-derived suffix instead of aborting on the UNIQUE violation —
  red repro (23505) → green. The createList local-dedup foundation test + client-learns-new-slug fold into
  the harness/cursor cards. Server CTE correctness cluster done (3 cards).
