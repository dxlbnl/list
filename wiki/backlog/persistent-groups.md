---
title: Persistent groups — groups that outlive their items
type: feature
priority: medium
flags: [review]
created: 2026-07-15
---

## What / why

Groups should be **durable, first-class things**, not implied by items. Today a group only exists while
some item carries its `groupName`, so users "constantly have to recreate groups" — an empty group
vanishes, and there's no way to make a group up front and then fill it. Let a user create a group, have
it persist while empty, reorder groups, and rename/delete it as an entity.

## Notes

Grounding: [groups](../knowledge/domain/groups.md), [lists](../knowledge/domain/lists.md),
[data-model](../knowledge/architecture/data-model.md).

What the current model forces (from the domain distillation) — the design must change all of these:
- **No group entity / no `createGroup`.** A group is just the set of distinct `groupName` strings across
  a list's items; a group is born only via `addItem(listId, name, groupName)`. → needs a first-class
  representation: a `groups` table/entity, or a `groupNames[]` + order field on the list.
- **`renameGroup` (actions.ts) early-returns on an empty group** (it rewrites items, and there are none)
  → rename must target the group entity, not item rows.
- **`deleteGroup` soft-deletes every item, and deleting the last item makes the group disappear** →
  group lifetime must be decoupled from item lifetime (this is the crux; overlaps
  [persist-empty-groups-and-delete](persist-empty-groups-and-delete.md), which should likely be folded
  into this feature).
- **Group order is derived from items** (`sortedGroupNames` in `[slug]/+page.svelte`), not persisted →
  needs explicit ordering.
- **The default `GENERAL` group is the `""` sentinel** converted at the write boundary → a group entity
  needs a real representation of the default.

Ripples: schema change (new entity/columns) → Zod [validations](../knowledge/architecture/data-model.md)
→ the sync CTE and Dexie schema → drag-and-drop (`svelte-dnd-action`) group containers. Coordinate with
[general-group-rename-quirk](general-group-rename-quirk.md) (the rename quirk likely dissolves once
groups are entities).
