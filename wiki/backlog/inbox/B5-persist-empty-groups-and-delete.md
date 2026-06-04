---
id: B5
title: Persist empty groups + explicit group deletion (don't erase a group when its last item leaves)
type: feature
priority: medium
flags: [review]
created: 2026-06-03
---

## Description

Groups currently exist implicitly — they're derived from the distinct `groupName`
values of *active* items on a list. As a side-effect, emptying a group (deleting or
moving away its last active item) silently erases the group; the user did not ask for
that and is now thinking it's not the right behaviour.

User's proposed direction (2026-06-03):

- **Persist empty groups.** A group should keep existing even when it has zero items.
  Today the model has no first-class concept of a group, so this likely means either
  introducing one (a groups table / Dexie store) or keeping a per-list "known groups"
  set somewhere.
- **Add an explicit "delete group" action.** Deletion should be an intentional act,
  not a side-effect of emptying. The proposed semantic: deleting a group **moves all
  its items (active *and* soft-deleted) into the default group** (`groupName: ""`,
  display "GENERAL"), then removes the group from the known-groups set.

This intersects (but is **not the same as**) B4: B4 fixes the default-group rename
no-op; B5 is about whether groups themselves are first-class and how they're deleted.

## Open questions (for spec-writer)

- Where do "known groups" live? Options worth costing: (a) a per-list `groups: string[]`
  field on the list, persisted in both Dexie and Postgres; (b) a separate `groups`
  table/store keyed by `(listId, name)`; (c) keep derive-from-items but add a tombstone /
  pinned-empty-group marker. Each has different sync-engine implications — the
  `sync.svelte.ts` + CTE endpoint already process per-row ops and the chosen shape needs
  to fit that batch model.
- How does an empty group enter existence in the first place? (Today it appears the
  moment the user puts an item in it.) Do we add a "create group" affordance, or do
  groups still come into existence by first-item-added and just stop disappearing
  on last-item-removed?
- What does the UI look like for "delete group"? Trash icon next to the group header?
  Confirm dialog?
- Sync conflict model when two clients delete the same group at once, or one renames
  while the other deletes — needs a defined resolution.
- Does the default group ("GENERAL", `groupName: ""`) have any of these affordances at
  all? Almost certainly the default group must always exist (it's the destination of
  every group-delete) and must not itself be deletable.

## Notes

- Raised by the user mid-conversation while answering B4's open questions
  (2026-06-03). Quoted: "deleting all items in a group, the group is removed, but I'm
  now thinking that's not desirable. Though I understand groups exist by distinct
  values of active items. Maybe we can leave groups empty, and do allow deleting a
  group, this should prolly happen by moving all items in that group (deleted and
  otherwise) to the default group."
- Architectural: touches the data model (client + server schema), the actions layer,
  the sync CTE, and the list UI. `flags: [review]` set so the manager pauses for
  approval after the spec is written.
- Cross-references: `wiki/architecture/data-model.md`,
  `wiki/architecture/conventions.md` (group naming), `wiki/features/lists.md` (groups
  section), `wiki/architecture/sync-engine.md` (CTE shape).
- **Related but distinct**: B4 (default-group rename no-op).
