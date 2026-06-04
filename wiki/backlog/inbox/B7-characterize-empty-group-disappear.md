---
id: B7
title: Characterise current "group disappears when emptied" behaviour (B5 prerequisite)
type: chore
priority: high
created: 2026-06-04
---

## Description

From B6 audit T4. Today, a group exists implicitly — its name is one of the
distinct `groupName` values of *active* items on a list. When the last active
item of a group is deleted (or moved away), the group vanishes from the UI
(`sortedGroupNames` no longer includes it).

B5 is going to reverse this behaviour (persist empty groups + add explicit
delete-group action). For B5's tests-first cycle to have a meaningful
red→green pivot, we need a test today that **locks in the current
"disappears on empty" behaviour** so B5 can later flip it from passing to
failing and back. Without it, B5's red baseline is invisible.

## Acceptance (definition of done)

1. A browser/Svelte test on the list page that:
   - mounts a list with a custom group containing one item;
   - deletes the item;
   - asserts the group name is no longer present in the rendered group list
     (or in whatever the source-of-truth `sortedGroupNames` is, depending on
     what the spec-writer can drive cleanly through the component).
2. Named clearly as a **characterisation** test (e.g. "current behaviour:
   group disappears when last active item is deleted (B5 will reverse this)").
3. Suite green (`pnpm test`, `pnpm check`).

## Notes

- Audit reference: `wiki/research/test-coverage-audit.md` T4.
- **Must land before B5** begins its tests-first cycle.
- Use the world from `src/lib/test/fixtures.ts` directly (per the D2 Rule);
  no fixture wrappers.
