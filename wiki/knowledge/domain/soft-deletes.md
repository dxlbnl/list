---
title: Soft deletes
type: mechanism
status: accepted
tags: [soft-delete, deleted-at, restore, recoverable, deletion]
---
Deleting an item is **soft**: it sets a `deletedAt` timestamp rather than removing the row, and default views filter out rows whose `deletedAt` is set. No user-facing path hard-deletes item data, so a deleted item stays recoverable in principle by nulling `deletedAt` — it keeps its `rank` and [group](groups.md), so it would return to its original position. Soft-delete is a binding rule ([the-rules](../project/the-rules.md)); see also [data-model](../architecture/data-model.md).

Current behaviour to be faithful about: the v1-described "creatable-select" restore UI is **not implemented** — there is no restore action and no surface that clears `deletedAt`, so from the user's side deletion is presently final. Whether to build a restore surface or drop the claim is tracked by a backlog card.

**Why:** soft delete is a safety net against accidental loss and keeps deletes *syncable* — a soft delete is just another field write that reconciles across devices, whereas a hard delete cannot converge with a concurrent edit to the same row. That convergence guarantee is why user data MUST be soft-deleted rather than removed.
