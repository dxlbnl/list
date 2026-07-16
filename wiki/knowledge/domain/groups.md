---
title: Item groups and the GENERAL default
type: mechanism
status: accepted
tags: [groups, general-group, group-name, lists, group-naming]
---
Each item within a list carries a `groupName`; a group is **not** a stored entity — it exists only as the set of distinct `groupName` values across the list's items. The empty string `""` is the default group, displayed as `GENERAL`; the `""` ↔ `GENERAL` conversion happens at the write boundary (`actions.ts` `renameGroup`/`deleteGroup`) and in the `[slug]` page, never in stored data. See [lists](lists.md), [the-rules](../project/the-rules.md).

Because groups are **implicit** (current behaviour): a group is created only by adding an item with that name (there is no `createGroup`); `renameGroup` rewrites `groupName` on every item in the group and *no-ops on an empty group* (it early-returns when zero items match); deleting a group soft-deletes its items. Rough edges — an empty group vanishes from the UI (no item references the name) and the default-group rename path has a reported quirk — are tracked by backlog cards.

**Why:** modelling a group as a per-item string keeps the schema flat and lets drag-and-drop move an item between groups with a single field write. The cost is that a group has no independent existence — it cannot outlive its items — which is the direct source of the empty-group-disappears and rename-quirk edges.
