# Component Extraction Candidates

This page identifies UI patterns that are repeated across multiple pages or parent components and would benefit from being extracted into reusable components in `src/lib/components/ui/`.

## 1. `InputGroup.svelte`

**Current locations**:
- `src/routes/+page.svelte` (Create List)
- `src/routes/[slug]/+page.svelte` (Add Item, Share URL display, Delete confirmation)
- `src/lib/components/ui/ListGroup.svelte` (Rename Group)
- `src/lib/components/ui/UserMenu.svelte` (Delete confirmation)

**Proposal**:
Create a component that accepts `bind:value`, `placeholder`, `prefix`, and an `onclick` handler for the action button.

```svelte
<InputGroup 
  bind:value={name} 
  placeholder="Enter name..." 
  prefix=">" 
  actionLabel="Add" 
  onAction={handleAdd} 
/>
```

---

## 2. `EmptyState.svelte`

**Current locations**:
- `src/routes/+page.svelte` ("No lists yet")
- `src/routes/[slug]/+page.svelte` ("List is empty")

**Proposal**:
Standardize the empty state layout (icon, title, message).

---

## 3. `QRCodeDisplay.svelte`

**Current locations**:
- `src/lib/components/ui/UserMenu.svelte` (Sync Device)
- `src/routes/[slug]/+page.svelte` (Share List)

**Proposal**:
Encapsulate the QR code generation logic (using `qrcode` lib) and the stylized white-background container. It should handle the "Loading..." state internally.

---

## 4. `ConfirmDeleteDialog.svelte`

**Current locations**:
- `src/lib/components/ui/UserMenu.svelte` (Delete List)
- `src/routes/[slug]/+page.svelte` (Delete List)
- `src/lib/components/ui/ListGroup.svelte` (Delete Group)

**Proposal**:
A high-level dialog component that takes a `targetName` and a `onConfirm` callback. It handles the "Type {name} to confirm" logic internally.

---

## 5. `ListCard.svelte`

**Current location**:
- `src/routes/+page.svelte`

**Proposal**:
Extract the list card into its own component. This would clean up the grid logic and make it easier to add features like "last updated" or "item count" to the cards later.

---

## 6. `Icon.svelte` (or individual SVG components)

**Current location**:
- Copied across almost every file with a menu or button.

**Proposal**:
Create a set of simple, consistent SVG components (e.g., `ChevronIcon`, `TrashIcon`, `ShareIcon`) to reduce template noise.
