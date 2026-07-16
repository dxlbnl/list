---
title: Persist empty groups + explicit group deletion
type: feature
priority: medium
flags: [review]
created: 2026-06-03
---

## What / why

Groups today exist **implicitly** — they're derived from the distinct `groupName`
values of *active* items on a list. As a side-effect, emptying a group (deleting or
moving away its last active item) silently erases the group. The user did not ask for
that and now thinks it's the wrong behaviour.

Desired direction (raised by the user 2026-06-03, quoted: *"Maybe we can leave groups
empty, and do allow deleting a group; this should prolly happen by moving all items in
that group (deleted and otherwise) to the default group."*):

- **Persist empty groups.** A group keeps existing even when it has zero items. The model
  has no first-class group today, so this means either introducing one (a groups
  table / Dexie store) or keeping a per-list "known groups" set somewhere.
- **Add an explicit "delete group" action.** Deletion becomes an intentional act, not a
  side-effect of emptying. Proposed semantic: deleting a group **moves all its items
  (active *and* soft-deleted) into the default group** (`groupName: ""`, display
  "GENERAL"), then removes the group from the known-groups set.

## Current behaviour (characterisation baseline — folded in from the prerequisite chore)

Locked in so this feature has a visible red→green pivot: today a group exists only while
it has ≥1 active item; deleting the last active item of a custom group makes it vanish
(`sortedGroupNames` on the list page drops it). A characterisation test in
`src/routes/[slug]/page.svelte.test.ts` mounts a list with a custom group holding one
item, deletes that item, and asserts the group name is no longer rendered — named to the
effect of "current behaviour: group disappears when last active item is deleted". This
feature will **reverse** that test (empty groups persist), so it stays in the suite as
the before-state anchor and its assertion flips from passing to the new expectation.

## Design questions (settle in the card before build — it's `review`-gated)

- **Where do "known groups" live?** Cost these: (a) a per-list `groups: string[]` field,
  persisted in both Dexie and Postgres; (b) a separate `groups` table/store keyed by
  `(listId, name)`; (c) keep derive-from-items but add a tombstone / pinned-empty-group
  marker. Each has different sync implications — the batch push and the sync CTE process
  per-row ops, so the chosen shape must fit that batch model.
- **How does an empty group come into existence?** Today it appears the moment the user
  adds an item. Do we add a "create group" affordance, or do groups still appear on
  first-item-added and just stop disappearing on last-item-removed?
- **UI for "delete group"** — trash icon on the group header? Confirm dialog?
- **Sync conflict model** when two clients delete the same group at once, or one renames
  while the other deletes — needs a defined resolution.
- **The default group** ("GENERAL", `groupName: ""`) must always exist (it's the
  destination of every group-delete) and must not itself be deletable.

## Notes

- Touches the data model (client + server schema), the actions layer, the sync CTE, and
  the list UI — see [groups](../knowledge/domain/groups.md),
  [data-model](../knowledge/architecture/data-model.md),
  [sync-model](../knowledge/architecture/sync-model.md),
  [server-modules](../knowledge/architecture/server-modules.md),
  [client-modules](../knowledge/architecture/client-modules.md), and
  [test-setup](../knowledge/testing/test-setup.md) for the component-test harness.
- **Related but distinct**: `general-group-rename-quirk` (the default-group rename
  investigation) — that fixes a rename no-op; this decides whether groups are
  first-class and how they're deleted.
- `flags: [review]`: the manager pauses for approval once the design is settled, before
  tests/impl.
