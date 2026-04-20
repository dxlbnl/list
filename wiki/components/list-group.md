# ListGroup Component

`src/lib/components/ui/ListGroup.svelte`

Renders a single named group of items within a list view. Handles collapsibility, drag-and-drop reordering (within the group), item completion, item deletion, group rename, and group delete — all via callback props.

→ See also: [UserMenu](user-menu.md) | [Bits UI Styling](bits-ui-styling.md) | [List Management](../features/lists.md)

---

## Props

```ts
let {
  groupName,       // string — display name; "GENERAL" for the default group
  groupItems,      // LocalItem[] — items in this group, sorted by rank
  showHeader,      // boolean — hide the header when there is only one group
  onRename,        // (newName: string) => void
  onDelete,        // () => void
  onToggleDone,    // (item: LocalItem) => void
  onDeleteItem,    // (item: LocalItem) => void
  onDndConsider,   // (e: CustomEvent) => void — fired during drag
  onDndFinalize,   // (e: CustomEvent) => void — fired on drop
} = $props();
```

All mutations are delegated upward via callbacks. The component holds **no** reference to `actions.ts` or `db` directly.

---

## Local State

| Variable | Rune | Purpose |
|---|---|---|
| `isOpen` | `$state(true)` | Collapsible open/closed |
| `isRenameDialogOpen` | `$state(false)` | Controls rename Dialog |
| `isDeleteDialogOpen` | `$state(false)` | Controls delete Dialog |
| `editName` | `$state("")` | Input value for rename |

`$effect`: Syncs `editName` ← `groupName` whenever the rename dialog opens, so the input is pre-filled.

---

## Structure

```
Collapsible.Root (.list-group-container)
  ├── [if showHeader]
  │     ├── Collapsible.Trigger (.group-header) — chevron + name + item count
  │     └── Menu.Root → Rename group / Delete group (Menu.Item)
  │
  └── Collapsible.Content
        └── div[use:dragHandleZone] (.list-group-item-stack)
              └── {#each groupItems}
                    li (.list-group-item-row)
                      ├── div[use:dragHandle] (.list-group-drag-handle) — "::"
                      ├── <Checkbox> — done toggle
                      ├── span (.list-group-item-name) — item name
                      └── button (.list-group-btn-delete) — "×"

Dialog (rename) — input + Rename button
Dialog (delete) — Delete group button
```

---

## Dependencies

| Library | Usage |
|---|---|
| `bits-ui` → `Collapsible` | Animated expand/collapse of item list |
| `./Menu` | Three-dot context menu for group actions |
| `svelte-dnd-action` | `dragHandleZone` (zone) + `dragHandle` (handle) directives |
| `svelte/animate` → `flip` | Smooth item reorder animation (200ms) |
| `./Checkbox` | Per-item done toggle |
| `./Dialog` | Rename + delete confirmation dialogs |

---

## CSS Classes (namespaced, all inside `:global {}`)

| Class | Element |
|---|---|
| `.list-group-container` | Collapsible root |
| `.group-header-container` | Header row (trigger + actions) |
| `.group-header` | Collapsible trigger button |
| `.group-actions` | Three-dot menu wrapper (fades in on hover) |
| `.btn-icon-tiny` | Three-dot menu trigger button |
| `.list-group-item-stack` | DnD zone container (`<div>`, min-height 20px) |
| `.list-group-item-row` | Individual item row (`<li>`) |
| `.list-group-drag-handle` | Drag handle "::" |
| `.list-group-item-name` | Item text (flex: 1) |
| `.list-group-btn-delete` | "×" delete button |
| `.list-group-dialog-actions` | Delete dialog button row |
| `#dnd-action-dragged-el` | Ghost element injected by svelte-dnd-action |

---

## DnD Integration

The component receives `onDndConsider` and `onDndFinalize` from the parent (`[slug]/+page.svelte`). The parent owns all group state (`localGroups`) and the final `updateItems()` call. This keeps the component stateless with respect to ordering.

The `#dnd-action-dragged-el` global style ensures the ghost element renders correctly above all other content (z-index 2000) and matches the row layout.
