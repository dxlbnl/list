---
title: Investigate the GENERAL-group rename quirk — reproduce-or-close
type: bug
priority: low
flags: [review]
created: 2026-06-03
---

## What / why

**Reframed after the test-coverage audit (finding L7).** The bug as originally described —
"the live `onRename` path skips the `"GENERAL" → ""` translation that some removed dead
code did, so renaming the default group is a no-op for items with `groupName: ""`" — does
not match the code today.

`src/lib/client/actions.ts` `renameGroup` *already* translates both ends:

```ts
const actualOldName = oldName === "GENERAL" ? "" : oldName;
const actualNewName = newName === "GENERAL" ? "" : newName;
```

and the live wiring in `src/routes/[slug]/+page.svelte` routes the group header's
`onRename` through `renameGroup(...)`, closing over the display string (`"GENERAL"` for
the default group, normalised from `item.groupName || "GENERAL"`). So a naive regression
test that calls `renameGroup("GENERAL", "Foo")` **passes against current code** — it proves
nothing.

Three hypotheses: (a) a path genuinely bypasses the translation that we haven't found;
(b) the original report was stale (the actions-layer translation post-dates the original
observation); or (c) the bug is in a layer above `renameGroup` (e.g. the dialog never
invokes `onRename` for the default group, or sends the wrong args). The right move is
**investigate before fix** — write one observation test through the **component path**
(rename dialog → `onRename` callback → `renameGroup` → mutation → re-render), then branch on
what it shows.

## Code surface this hinges on (pinned — re-verify before changing anything)

- `src/lib/client/actions.ts` `renameGroup` — translates `"GENERAL" ↔ ""` on both
  `oldName` and `newName` before the Dexie write; reads items via
  `db.items.where({ listId, groupName: actualOldName })` through `updateItems` (which
  queues sync ops); early-returns if no items match.
- `src/routes/[slug]/+page.svelte` — `localGroups` keying + `sortedGroupNames`; empty-string
  `item.groupName` is normalised to display `"GENERAL"`, pinned first. The `<ListGroup>`
  loop passes the display string as `groupName` and closes `onRename` over it.
- `src/lib/components/ui/ListGroup.svelte` — the rename dialog. `editName` initialises from
  the `groupName` prop via a `$effect`, then `InputGroup`'s `onAction` calls
  `onRename(editName)` — the dialog forwards exactly the user-typed text. The Rename button
  is disabled while `editName === groupName` (no-op rename blocked).
- `src/lib/client/db.ts` — Dexie schema; items indexed by `[listId+groupName]`, so the
  `where({ listId, groupName: "" })` query is index-backed (no full-table scan masking a
  bug).

The most likely place a real bug would live is the dialog → callback args path; the
existing `actions.ts` translation catches both ends, so an unfound bypass would have to
come from a different surface (a code path mutating `groupName` outside `renameGroup`, or
state desync between Dexie and `localGroups` during the rename — no evidence for either yet).

## The investigation

**R1 — component-path observation test (write first).** A test MUST mount the list page
in a state with both a default (`groupName: ""`) item and a custom-group item, drive the
rename UI for the default group, and assert on rendered DOM (and, where relevant, persisted
Dexie state). It MUST NOT call `renameGroup` directly — it exercises the component plumbing
end-to-end.

- Scenario: seed a list (via the `world` in `src/lib/test/fixtures.ts`) with `"Apple"`
  (`groupName: ""`, under the `GENERAL` header) and `"Bread"` (`groupName: "Bakery"`, so
  headers render). Render the page, open the menu on the `GENERAL` header, click "Rename
  group", type `"Snacks"`, submit. THEN `Apple` renders under a `Snacks` header, the
  `GENERAL` header is gone, and `Bakery`/`Bread` is unchanged.

The card branches on R1's outcome:

**Branch A — R1 reproduces a failure** (`Apple` doesn't move to `Snacks`, stays under
`GENERAL`, or vanishes):
1. Trace where the user input becomes the args to `renameGroup` and locate the surface not
   translating between display and stored names. Candidates in priority order: (i) the
   `groupName` the `<ListGroup>` closure captures at submit vs. at render (state desync);
   (ii) whether `Apple`'s `groupName` in Dexie is actually `""` at test start or was
   written as the literal `"GENERAL"` upstream (e.g. by `addItem`, `handleDndFinalize`, or
   the sync pull); (iii) whether `renameGroup`'s `where({ listId, groupName: "" })` query
   actually matches the seeded items via the compound index.
2. Apply the **smallest** fix that makes R1 pass without weakening it (don't relax the
   assertion, swap the THEN target, or move it off the rendered DOM). The fix need not be
   at the `onRename` wiring.
3. **No symmetric breakage on the TO side**, each with its own scenario:
   - rename default → `"Snacks"` stores `groupName === "Snacks"` (never the literal
     `"GENERAL"`);
   - rename a custom group (`"Bakery"`) → `"GENERAL"` stores `groupName === ""` (never the
     literal string), and the page renders both items under one `GENERAL` header.
4. Full suite green.

**Branch B — R1 passes against current code** (no product change needed):
1. Keep R1 as a **characterisation** test — its `describe`/`it` text contains
   "characterisation" and a code comment cites this card, mirroring the existing
   characterisation test in `src/routes/[slug]/page.svelte.test.ts`.
2. Close the card `cancelled` with a one-line `## Notes` entry: "Investigated via the
   component-path test; bug did not reproduce." Record the not-reproducible finding where
   the manager keeps such notes (a line on this card / the run log).
3. Full suite green.

## Out of scope

- **Empty / deletable groups** — whether a group persists when its last item is deleted is
  `persist-empty-groups-and-delete`. This test seeds two non-empty groups precisely so
  headers render; it does not exercise empty-group behaviour.
- **Delete-group flow** — `handleDeleteGroup` in `+page.svelte` has its own `"GENERAL" → ""`
  translation. If Branch A surfaces a parallel bug there, file it as a new item; don't
  bundle it here.
- **The wider sync path** — the test asserts on local Dexie + rendered DOM, no server
  round-trip; `fetch` is stubbed.
- **Schema / wire-format changes** — none required. The `"GENERAL" ↔ ""` translation is a
  UI-layer convention; the stored value is and remains the empty string.

## Notes

- The `"GENERAL"` display sentinel for stored `""` and the group-naming convention live in
  [groups](../knowledge/domain/groups.md); `actions.ts`/`renameGroup` in
  [client-modules](../knowledge/architecture/client-modules.md); the component-test harness
  and fixtures in [test-setup](../knowledge/testing/test-setup.md) and
  [fixtures](../knowledge/testing/fixtures.md).
- `flags: [review]`: the card branches on the investigation outcome, so the manager pauses
  for approval before tests/impl.

## History

- Filed from an earlier item's flag as `needs-answers`; user answered (default group is
  renameable; `"GENERAL"` is the display sentinel), answers folded.
- Reframed after the coverage audit (L7): `renameGroup` already does the `"GENERAL" → ""`
  translation, so the original "fix the live path" framing is wrong. Now an
  investigate-or-close item; added `flags: [review]`.
