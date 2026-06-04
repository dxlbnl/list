---
id: B18
title: Decide soft-delete restore UX — build the creatable-select restore or remove the wiki claim
type: research
priority: low
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L8. `wiki/features/soft-deletes.md` documents a "restore
via creatable-select" UX where typing a deleted item's name into the
add-item input offers to restore it (clear `deletedAt`). **The
implementation does not exist** — grep shows no `restore` action in
`actions.ts` and no UI surface that clears `deletedAt`.

Either the feature was planned and never built (current behaviour =
deletion is final from the user's perspective) or the feature regressed
and was removed. Either way: decide whether to build it or remove the
wiki claim.

## Research question

Is the creatable-select restore UX (as described in
`wiki/features/soft-deletes.md`) something we want to ship, or has the
intent shifted to "soft-delete is purely a server-side undo safety net
with no user-facing recovery"? If we ship it, what's the simplest design
that fits the existing add-item flow without making the input feel
overloaded?

## Output (definition of done)

`wiki/research/restore-ux.md` containing:

1. A brief read of `wiki/features/soft-deletes.md` as written, called
   out: what UX does the wiki promise?
2. A short look at the existing add-item flow + the `ListItem`
   component to see where the creatable-select would hook in.
3. A recommendation: **(A)** build the restore UI as the wiki describes
   (file a feature item with a spec), **(B)** build a different restore
   surface (e.g. a "deleted items" panel on the list — describe), or
   **(C)** drop the feature; update `wiki/features/soft-deletes.md` to
   say soft-delete is a server-side safety net only, with no
   user-facing restore.
4. A "what to file next" line.

## Notes

- Audit reference: `wiki/research/test-coverage-audit.md` L8.
- `flags: [review]`: design question; user picks A/B/C.
- **Out of scope** until decided: any test work on restore (there's
  nothing to test).
