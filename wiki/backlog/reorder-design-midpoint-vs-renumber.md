---
title: Decide reorder strategy — midpoint-float O(1) vs. accept full renumber
type: research
priority: low
flags: [review]
created: 2026-06-04
---

## What / why

`src/routes/[slug]/+page.svelte` `handleDndFinalize` assigns `rank: index` — every drag
rewrites the rank of every item in every group whose rank ≠ its index. That's the opposite
of the **float-midpoint O(1) reorder** the knowledge graph currently promises for lists.
It's functionally correct, but the payload to `/api/sync` balloons linearly with list size
on every drop.

No test is proposed yet: writing one for the current renumber behaviour would lock in
something we may want to change. Decide first. (Surfaced by the test-coverage audit as
finding L6.)

## Research question

For each of {tiny lists (< 20 items), shared collaborative lists with chatter, very long
lists (100+ items)}: is the current full-renumber strategy a real problem in practice, and
is implementing midpoint floats worth the added complexity (rank rebalancing when
neighbours collide, overflow handling, sync-conflict semantics on the float math)?

## Output (definition of done)

A written recommendation (captured as/into the relevant knowledge atom — see Notes)
containing:

1. A short measurement of current per-drop sync payload size on lists of {10, 100, 500}
   items (back-of-envelope is fine).
2. A description of midpoint-float as the knowledge graph currently describes it, with the
   real complications: when do floats need rebalancing? how do two clients reordering the
   same window concurrently merge? what's the failure mode on a float collision?
3. A recommendation — **(A)** implement midpoint floats (file a feature item with the
   design); **(B)** accept current full-renumber and update the [lists](../knowledge/domain/lists.md)
   + [data-model](../knowledge/architecture/data-model.md) atoms to match (file a wiki
   chore); or **(C)** a hybrid (e.g. midpoint within a group, renumber on collision, with a
   documented threshold).
4. A "what to file next" line so the manager can act.

## Notes

- The reorder mechanism lives in [lists](../knowledge/domain/lists.md) and
  [data-model](../knowledge/architecture/data-model.md); the sync-payload angle in
  [sync-model](../knowledge/architecture/sync-model.md).
- Out of scope until decided: any test of the reorder behaviour.
- The user's preference around sync payload size (esp. for collaborative use) is a key
  input — surface it if it pivots the recommendation.
- `flags: [review]`: design decision; the user approves the recommendation before anything
  is built/changed.
