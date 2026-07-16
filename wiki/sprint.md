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
- [x] **sync-async-test-harness** — two-client node-tier harness (fake fetch → pglite, injected Dexie) ✅; proves cross-device convergence + the apply-guard/data-loss repros.

**Server — one coherent CTE rewrite on the new schema:**
- [x] **sync-cursor-delta-transport** — server + client ✅ (`updated_seq` cursor; `/api/sync` returns `{results,changes,cursor}`; client tracks the cursor, folds pull into push + `pullDelta` backfill). Migration `0001` needs `db:push`; HLC still to do.
- [x] **sync-cte-insert-update-data-loss** — coalesce same-id INSERT+UPDATE ✅ (fix + pglite regression green).
- [x] **sync-cte-upsert-lists-authz-hole** — force `created_by = user.id` ✅ (fix + pglite regression).
- [x] **slug-collision-sync-batch-failure** — server auto-rename on `(user,slug)` collision ✅ (fix + pglite regression). Per-op isolation lands with no-stall; client learns the new slug via the cursor delta.
- [x] **sync-no-stall-one-poison-op** — gentle backoff (2s base, cap 30s — no 20s cliff) + poison-op quarantine (drop the wedged batch after 5 fails); server already per-op ✅.

**Client:**
- [x] **sync-apply-lww-guard** — single guarded apply path `applyServerItem` (apply-iff-newer + pending) ✅ (resurrection fixed; node-tier tests). Self-echo subsumed by the guard.
- [x] **sync-realtime-guarded-primary** — Realtime applies inline through the guard; cursor delta = editor push-fold; `pullDelta` backfill on loop/online/visibility ✅.
- [x] **sync-loop-reconverge-items** — the loop now calls `pullDelta` each pass (cursor backfill), so a missed realtime event still reconverges ✅.

**Ordering:**
- [x] **sync-fractional-index-reorder** — `rankBetween` midpoint; the DnD handler now persists **only the moved item** ✅ (kills the N-writes-per-drag amplifier). Unit-tested.

**Invariant nets (build alongside the above):**
- [ ] [cte-invariant-safety-net](backlog/cte-invariant-safety-net.md) — server CTE invariants (pglite): LWW, soft-delete preservation, validator drop-undefined.
- [ ] [sync-engine-invariant-safety-net](backlog/sync-engine-invariant-safety-net.md) — client engine invariants: pending-wins, apply-guard, reconciliation.
- [x] **harness-pull-non-items-response** — `pull` guards `data.items ?? []` (no crash on a non-items response) ✅.

**Next:** the two-client async harness, then the client side of the cursor delta + the client cards
(apply-guard, realtime-guarded, no-stall, loop, reorder) and the HLC LWW swap.

> ⚠ **DB migration pending:** `drizzle/0001_reflective_maria_hill.sql` (sequence + `updated_seq` +
> `lists.updated_at`) must be applied to Neon via `pnpm db:migrate` (or `pnpm db:push`) before the app's
> `/api/sync` works against it — until then the CTE's `nextval('sync_seq')` errors on the un-migrated DB.
> pglite tests already run against the new schema.

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
- 2026-07-16 — **Backbone (server side).** Added the `updated_seq` sequence + columns (+ `lists.updated_at`);
  the CTE bumps `updated_seq` on every upsert and `processSyncBatch` folds the pull into the response
  (`{ results, changes, cursor }`) — member-visible rows since the caller's cursor. pglite: insert returns
  the row + advances the cursor; a caught-up pull is empty; a later edit shows in a delta from the old
  cursor. 10/10 green, check/lint clean. Migration `0001_reflective_maria_hill.sql` generated (needs
  `pnpm db:migrate`/`db:push` on Neon). Client cursor + HLC still to do.
- 2026-07-16 — **Client apply-guard (the resurrection fix).** Refactored `SyncManager`: exposed a testable
  `createSyncManager(db)` factory + parameterized `ListDatabase(name)`; Realtime + pull now go through one
  guarded `applyServerItem` (drops a server row not strictly newer than local, or with a pending op). Node-tier
  tests (`sync-engine.spec.ts`, fake-indexeddb — no chromium): a stale echo can't un-delete; newer applies;
  pending wins. This also **proves the client-side harness approach**. 13/13 green, check/lint clean.
- 2026-07-16 — **Cursor-delta client + harness cluster (5 cards).** `SyncManager`: fetch DI, cursor tracking
  (persisted), `applyChanges` (apply delta + advance cursor), `pullDelta` (idle/backfill), gentle backoff
  (2s base / 30s cap, no 20s cliff), poison-op quarantine. Loop + online + visibility now cursor-backfill.
  Two-client harness (`sync-harness.spec.ts`, fake fetch → `processSyncBatch` on shared pglite) proves A→B
  cross-device convergence with no realtime. Closed: cursor-delta, realtime-guarded, no-stall, loop-reconverge,
  async-harness. 14/14 green, check/lint clean.
