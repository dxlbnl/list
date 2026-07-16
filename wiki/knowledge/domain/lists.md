---
title: List reorder via float ranks
type: mechanism
status: accepted
tags: [lists, reorder, drag-and-drop, ranks, float-rank, groups]
---
Items in a list are ordered by a numeric `rank` (Postgres `double precision`). A reorder drops an item to a new rank *between* its neighbours (between `1.0` and `2.0` → `1.5`), so a single-row write moves it — O(1), with no index shifting or renumbering of siblings. New items append with a timestamp-derived rank. Drag-and-drop uses `svelte-dnd-action`; dragging an item into another group container also rewrites its [group](groups.md) (`groupName` + `rank`). See [data-model](../architecture/data-model.md).

Known open question (a backlog card tracks it): **rank exhaustion** — float precision eventually runs out between two very close neighbours, needing a renormalisation pass. Related, the live drag handler currently *full-renumbers* (`rank: index`) rather than inserting a midpoint, so the midpoint-vs-renumber strategy is not yet settled.

**Why:** float ranks turn reorder into one row update instead of an O(n) renumber of the whole list — the local-first write path ([what-it-is](../project/what-it-is.md)) must feel instant, and small sync payloads matter for shared lists. Midpoint inserts keep that O(1) property but risk precision exhaustion; full-renumber is simpler but grows the per-drop sync payload linearly with list size — hence the unresolved design question.
