---
id: B4
title: Group rename may not handle the "GENERAL" → "" translation
type: bug
priority: low
created: 2026-06-03
flags: [needs-answers]
---

## Description

Flagged by the B2 implementer while removing a dead function. `src/routes/[slug]/+page.svelte`
had an unused `handleRenameGroup` that translated the `"GENERAL"` sentinel group name to `""`
before calling `renameGroup(...)`. It was genuinely dead (no callers) and was removed in B2.

The **live** path is `ListGroup`'s inline `onRename` (~`[slug]/+page.svelte:360`), which calls
`renameGroup(data.listId, groupName, newName)` **without** that `"GENERAL" → ""` translation.
So renaming the default/"GENERAL" group may persist the literal `"GENERAL"` (or otherwise
misbehave) where the dead code intended an empty string.

This is **pre-existing** (not introduced by B2) and unconfirmed — it needs reproduction.

## Open questions (triage before working)

- Is `"GENERAL"` a real sentinel for the default/ungrouped group, and should renaming it map
  to `""` (or be disallowed entirely)? Check `architecture/conventions.md` "group naming" and
  how groups are read back / displayed.
- Can the default group even be renamed in the UI, or is the rename affordance hidden for it?
  (If hidden, this may be a non-issue.)

## Acceptance (once confirmed)

- A regression test (this is a `bug` → tests-first) reproducing the wrong-rename behavior for
  the `"GENERAL"`/default group, then the fix in the inline `onRename` path (or wherever the
  translation belongs), green.

## Notes

- Confirm the bug is real before building — if the default group can't be renamed, close as
  invalid. Needs a quick repro in the running app or a unit test around the rename action.
