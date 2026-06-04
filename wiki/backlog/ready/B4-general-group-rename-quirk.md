---
id: B4
title: Investigate the GENERAL-rename bug — reproduce-or-close (the translation is already in actions.ts)
type: bug
priority: low
flags: [review]
created: 2026-06-03
---

## Description

**Reframed 2026-06-04 after the B6 audit finding (L7):** the bug as originally
described — "the live `onRename` path skips the `'GENERAL' → ""` translation
that the removed dead code did" — does not match what's in the code today.

`src/lib/client/actions.ts:148-150` *already* does the translation
(`actualOldName = oldName === "GENERAL" ? "" : oldName`), and the live inline
`onRename` at `src/routes/[slug]/+page.svelte:359-360` routes through
`renameGroup(...)`. So a naive regression test that calls `renameGroup("GENERAL", ...)`
will **pass against current code** — it would prove nothing.

Either: (a) the audit's read is wrong and there's a path that genuinely bypasses
the translation that we haven't found; (b) the original bug report was stale
(the actions-layer translation post-dates the B2 observation); or (c) the bug
reported is in a layer above `renameGroup` (e.g. the dialog never invokes
`onRename` for the default group, or sends the wrong arguments).

The right move is **investigate before fix**. Write a real test that exercises
the **component path** (rename dialog → `onRename` callback → `renameGroup`
through the actual UI plumbing), see whether the original bug reproduces, then
decide.

## Acceptance (definition of done)

This card branches based on what the investigation finds. The spec-writer should
encode both branches in the spec; the test-writer writes the investigation test
first; the implementer either fixes the real bug or closes the card invalid.

### Branch A — `T3` reproduces a failure (the original bug is real, just mis-located)
1. **Component-path regression test (browser/Svelte, red first).** Mount the
   list page in a state that has a default ("GENERAL") group with items
   (`groupName: ""`), drive the rename dialog to rename it to a non-empty name,
   assert the items end up with `groupName: "<new name>"`. **Do not call
   `renameGroup` directly** — go through the component plumbing so the test
   exercises whatever the dead `handleRenameGroup` was meant to fix.
2. **Find the actual bypass.** Spec-writer + implementer trace where the user's
   input becomes the args to `renameGroup`. Likely candidates: the dialog
   submits the *display* name instead of routing through whatever should
   normalise it; a different code path entirely (e.g. delete-group dialog) is
   the one with the missing translation; the `ListGroup` component sends the
   raw display string and `actions.ts:renameGroup`'s translation only catches
   the bare-string case but not what the component actually sends.
3. **Fix the real bypass** (not necessarily at `+page.svelte:359-360`).
4. **No symmetric breakage on the TO side** (renaming into the default group
   stores `groupName: ""`, not the literal `"GENERAL"`).
5. Full suite green.

### Branch B — `T3` passes against current code (the original observation was stale)
1. The same component-path test from step 1 above is **kept as a
   characterisation test** (green from the start) so future regressions are
   caught. Note in the test name + comment: "kept as characterisation after
   B4 reproduced no failure; was originally filed as a bug fix."
2. **Close B4 invalid.** Move the card to `done/` with
   `flags: [cancelled]` and a one-line `## Notes` entry explaining the bug
   did not reproduce. The B2 implementer's observation goes into the wiki's
   `issues.md` as "investigated, not reproducible — see B4".
3. Full suite green.

## Notes

- The B6 audit's L7 spells out the analysis: `wiki/research/test-coverage-audit.md`
  → "L7 — B4's described bug may already not trigger".
- Per `architecture/conventions.md` "group naming", `"GENERAL"` is the display
  sentinel for `groupName: ""`. The spec-writer should cross-check that page.
- Related but **out of scope**: empty/deletable groups (B5).
- `flags: [review]`: because the card now branches on investigation outcome
  the manager pauses for user approval of the spec before tests/impl begin.

## History

- 2026-06-03 — filed by manager from B2's flag; `needs-answers`.
- 2026-06-03 — user answered (default group renameable; `"GENERAL"` is the
  display sentinel); answers folded, moved to `ready/`.
- 2026-06-04 — **reframed** after B6 audit (L7): `actions.ts:renameGroup`
  already does the `"GENERAL" → ""` translation, so the original "fix the
  live path" framing is wrong. Card is now an investigation: reproduce via
  the component path, then either fix the real bypass (Branch A) or close
  as not-reproducible (Branch B). Added `flags: [review]`.
