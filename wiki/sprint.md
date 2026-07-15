# Sprint — current

> The one working-state file: a sprint goal + active tasks + a **Next** pointer + an append-only run
> log. Resume from **Next**. At sprint close: retro → learnings become atoms → **archive** the sprint
> to `wiki/sprint-archive/NNNN-slug.md`, then clear this file for the next sprint.

## Sprint goal

Migrate to Vibin v2 and tee up the next wave of work (sync overhaul, persistent groups, gift lists).

## Tasks

- [x] Migrate machinery to v2 (agents/skills/hooks/CLAUDE.md/settings) — committed
- [x] Distil the v1 wiki into the `wiki/knowledge/` graph; flatten the backlog to v2 cards
- [x] File the three new ideas as backlog cards (sync-overhaul, persistent-groups, gift-lists)
- [x] Run the `researcher` deep-dive on sync (< 1s / single round-trip) → atoms + redesign proposal
- [ ] **Compose the first real v2 sprint with the user** (sprint boundary = checkpoint)

**Next:** Migration + sync research done. PAUSE for the user to compose the first proper v2 sprint —
pick which of sync-overhaul / persistent-groups / gift-lists to run first, and settle the three sync
design decisions in [sync-redesign](knowledge/architecture/sync-redesign.md).

## Run log

<!-- append-only: one-liners at meaningful steps; don't trim mid-sprint; archived verbatim at close -->

- 2026-07-15 — v2 machinery migrated (b54b0d6): dropped spec/test/impl relay + manager/wiki/wiki-sync/tdd-cycle/interview; added loop/orchestrate/run + researcher/sprint-runner + capture/retrieve/sprint-close hooks. Committed.
- 2026-07-15 — Distilled ~30 v1 wiki pages into 21 knowledge atoms (project/architecture/testing/domain/conventions) via 4 parallel distillers; binding rules carried verbatim into `project/the-rules.md`. Deleted the v1 monoliths + reference pages.
- 2026-07-15 — Flattened 15 lane cards → 14 v2 flat cards (card-is-spec); folded B4 spec + B7 characterisation into their cards; dropped B15 (obsoleted by this migration). Key divergences surfaced by distillers: pull is Supabase Realtime not SSE; reorder handler full-renumbers (not midpoint float); in-app rate limiting still live (contradicts the-rules); no restore UI built.
