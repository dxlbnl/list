---
title: Decide soft-delete restore UX — build the creatable-select restore or drop the claim
type: research
priority: low
flags: [review]
created: 2026-06-04
---

## What / why

The knowledge graph describes a "restore via creatable-select" UX where typing a deleted
item's name into the add-item input offers to restore it (clear `deletedAt`). **The
implementation does not exist** — there's no `restore` action in `actions.ts` and no UI
surface that clears `deletedAt`. Either the feature was planned and never built (current
behaviour = deletion is final from the user's perspective) or it regressed and was removed.
Decide whether to build it or drop the claim. (Surfaced by the test-coverage audit as
finding L8.)

## Research question

Is the creatable-select restore UX something we want to ship, or has the intent shifted to
"soft-delete is purely a server-side undo safety net with no user-facing recovery"? If we
ship it, what's the simplest design that fits the existing add-item flow without making the
input feel overloaded?

## Output (definition of done)

A written recommendation (captured as/into the relevant knowledge atom — see Notes)
containing:

1. A brief read of the current soft-delete knowledge: what restore UX does it promise?
2. A short look at the existing add-item flow + the `ListItem` component to see where a
   creatable-select would hook in.
3. A recommendation — **(A)** build the restore UI as described (file a feature item with a
   spec); **(B)** build a different restore surface (e.g. a "deleted items" panel on the
   list — describe); or **(C)** drop the feature and update the
   [soft-deletes](../knowledge/domain/soft-deletes.md) atom to say soft-delete is a
   server-side safety net only, with no user-facing restore.
4. A "what to file next" line.

## Notes

- Soft-delete semantics + the claimed restore UX live in
  [soft-deletes](../knowledge/domain/soft-deletes.md); the add-item flow / components in
  [client-modules](../knowledge/architecture/client-modules.md).
- Out of scope until decided: any test work on restore (there's nothing to test yet).
- `flags: [review]`: design question; the user picks A/B/C.
