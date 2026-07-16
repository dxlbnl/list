---
title: Midpoint fractional-index reorder (replace full-renumber)
type: feature
priority: medium
flags: []
created: 2026-07-16
---

## What / why

`src/routes/[slug]/+page.svelte` `handleDndFinalize` assigns `rank: index` — every drag
rewrites the rank of every item whose rank ≠ its index. It's functionally correct, but the
payload to `/api/sync` balloons **linearly with list size** on every drop: one gesture emits up
to N item UPDATEs → N row writes → **N Realtime echoes** and N cursor bumps. This is the
sync-latency **payload amplifier**.

**Fix.** Replace full-renumber with true **midpoint fractional-index inserts**: a reorder drops
an item to a rank *between* its neighbours (between `1.0` and `2.0` → `1.5`) — one row write,
O(1), minimal payload, conflict-free under concurrent reorder. Add an occasional
**renormalization** pass for float exhaustion (precision eventually runs out between two very
close neighbours). New items keep appending with a timestamp-derived rank; dragging into
another group still rewrites `groupName` + `rank`.

**Design context** (folded in from the former `reorder-design-midpoint-vs-renumber` research
card — report it for deletion): the decision is **(A) implement midpoint floats**. The open
complications to handle: when floats need rebalancing (renormalize on collision / a documented
threshold), how two clients reordering the same window merge (fractional indexing is
order-conflict-free; the per-field merge covers the rank field), and the failure mode on a
float collision (fall back to renormalize). Back-of-envelope: current per-drop payload scales
O(list size); midpoint makes it O(1), which is what matters for shared collaborative lists.

## Notes

Epic: [Sync overhaul](sync-single-roundtrip-overhaul.md) — **Stage 2 (Ordering)**. Complements
the [per-field LWW-Map](sync-per-field-lww-map.md): ordering stays a fractional-index CRDT while
scalar fields merge per-field. Fixes the payload amplifier called out in
[sync-latency](../knowledge/architecture/sync-latency.md).

Atoms: [lists](../knowledge/domain/lists.md) (float ranks + the midpoint-vs-renumber open
question this settles — update it to match once built),
[data-model](../knowledge/architecture/data-model.md),
[sync-latency](../knowledge/architecture/sync-latency.md).
</parameter>
