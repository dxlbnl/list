---
id: B17
title: Decide reorder strategy — implement midpoint-float O(1) (as the wiki promises) or accept full renumber and update the wiki
type: research
priority: low
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L6. `src/routes/[slug]/+page.svelte:156-167`
(`handleDndFinalize`) assigns `rank: index` — every drag rewrites the
rank of every item in every group whose rank ≠ its index. That's the
opposite of the **float-midpoint O(1) reorder** described in
`wiki/features/lists.md` (and partially flagged in
`architecture/data-model.md`). Functionally correct; payload to
`/api/sync` balloons linearly with list size on every drop.

The audit deliberately did **not** propose a test, because writing a
test for the current renumber behaviour would lock in something the wiki
promises we want to change. Decide before testing.

## Research question

For each of {tiny lists (< 20 items), shared collaborative lists with
chatter, very long lists (100+ items)}: is the current full-renumber
strategy a real problem in practice, and is implementing midpoint floats
worth the added complexity (rank rebalancing when neighbours collide,
overflow handling, sync conflict semantics on the float math)?

## Output (definition of done)

`wiki/research/reorder-design.md` containing:

1. A short measurement of current per-drop sync payload size on lists of
   {10, 100, 500} items (back-of-envelope is fine if real numbers are
   hard).
2. A description of midpoint-float as the wiki currently describes it,
   with the actual complications: when do floats need rebalancing? how
   do two clients reordering the same window concurrently merge? what's
   the failure mode if a float collision happens?
3. A recommendation: **(A)** implement midpoint floats (file a feature
   item with the design), **(B)** accept current full-renumber and
   update `wiki/features/lists.md` + `architecture/data-model.md` to
   match (file a wiki chore), or **(C)** a hybrid (e.g. midpoint within
   a group, renumber if collision, with a documented threshold).
4. A "what to file next" line so the manager can act.

## Notes

- Audit reference: `wiki/research/test-coverage-audit.md` L6.
- `flags: [review]`: design decision; user approves the recommendation
  before anything is built/changed.
- **Out of scope** until decided: any test of the reorder behaviour.
- The user's preference around sync payload size (esp. for
  collaborative use) is a key input — surface in the report if it
  pivots the recommendation.
