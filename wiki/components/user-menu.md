# UserMenu Component

`src/lib/components/ui/UserMenu.svelte`

The global user avatar, sync status indicator, and navigation dropdown. Rendered by `Header.svelte` on every page. Also the injection point for page-specific contextual actions (share, delete list) via the `menuState` pattern.

→ See also: [ListGroup](list-group.md) | [Client Modules](../architecture/client-modules.md) | [Authentication](../features/auth.md)

---

## Props

```ts
let { user } = $props();
// user: { id: string, email: string | null, email_verified: boolean } | null
```

---

## Local State

| Variable | Rune | Purpose |
|---|---|---|
| `qrCodeDataUrl` | `$state("")` | Base64 QR image for sync dialog |
| `isSyncDialogOpen` | `$state(false)` | Controls "Sync Device" dialog |
| `isDeleteDialogOpen` | `$state(false)` | Controls "Delete List" dialog |
| `isLoadingQr` | `$state(false)` | QR generation loading state |
| `confirmDeleteName` | `$state("")` | Input for delete confirmation |

**`$derived`**:
- `currentList` ← `page.data.initialList` — the list currently being viewed (used for delete confirmation)
- `statusColor` ← `syncManager.isOnline` / `syncManager.isSyncing` — maps to CSS color vars
- `statusText` ← same — `"Offline"` / `"Syncing..."` / `"Online"`

**`$effect`**: Calls `handleSyncDevice()` when `isSyncDialogOpen` becomes true.

---

## Structure

```
div (.user-menu-container)
  Menu.Root
    Menu.Trigger (.user-trigger)
      div (.avatar) — user initial + status dot (.status-indicator)
      div (.user-label-container)
        span (.user-id) — email prefix or first 8 chars of id
        span (.status-text) — "Online" / "Syncing..." / "Offline"
      svg (.chevron)

    Menu.Content
      div (.menu-status-header) — status dot + status text

      Menu.Separator
      Menu.Group
        [if email_verified]  Menu.Item → /settings
        [else]               Menu.Item (accent) → /settings (Register)
                             Menu.Item (muted) → /login
        Menu.Item → isSyncDialogOpen = true

      [if menuState.contextualSnippet]
        Menu.Separator
        Menu.Group → {#render menuState.contextualSnippet()}

      [if email_verified]
        Menu.Separator
        Menu.Group → Menu.Item (danger) → handleLogout()

  Dialog (Sync Device) — QR code image or loading/error state
  Dialog (Delete List) — confirm-by-name input + Delete button
```

---

## Server Calls (direct `fetch`, not via `actions.ts`)

| Endpoint | When |
|---|---|
| `POST /api/auth/clone` | `handleSyncDevice()` — generates a session-clone magic link, then renders it as a QR code via `qrcode` |
| `POST /api/lists/[id]/share` | Called by the `[slug]` page via `contextualSnippet`, not directly here |

---

## Dependencies

| Import | Usage |
|---|---|
| `./Menu` | Custom Bits UI DropdownMenu wrapper |
| `syncManager` | `isOnline`, `isSyncing` for status display |
| `menuState` | Reads `contextualSnippet` (set by the list detail page) |
| `db` (Dexie) | `dexieDb.delete()` on logout — wipes local DB |
| `deleteList` from `actions.ts` | Called when delete confirmation passes |
| `page` from `$app/state` | Reads `page.data.initialList` for delete flow |
| `goto` from `$app/navigation` | Redirects to `/` after delete |
| `qrcode` | Converts URL to base64 PNG QR code |
| `fly` from `svelte/transition` | (imported, available for future use) |

---

## Contextual Menu Pattern

The `[slug]` page uses a Svelte action (`registerContextualMenu`) to inject a `{#snippet contextualMenuItems()}` into `menuState`. This snippet contains "Share list" and "Delete list" `DropdownMenu.Item` elements. `UserMenu` renders them inside the user dropdown between a separator pair.

The action's `destroy()` lifecycle clears the snippet when the page unmounts, so the items only appear when viewing a list.

---

## CSS Classes (namespaced, all inside `:global {}`)

| Class | Element |
|---|---|
| `.user-menu-container` | Root wrapper |
| `.user-trigger` | Menu trigger button (pill shape) |
| `.avatar` | Circular avatar with monogram |
| `.status-indicator` | Small dot on avatar (online/syncing/offline colour) |
| `.user-label-container` | Column: user-id + status-text |
| `.user-id` | Truncated email prefix or ID |
| `.status-text` | "Online" etc., coloured via `style:color` |
| `.chevron` | Dropdown chevron arrow |
| `.menu-status-header` | Top section of open dropdown |
| `.status-dot` | Larger status dot in dropdown header |
| `.user-menu-qr-wrapper` | Dialog inner layout |
| `.user-menu-qr-container` | White QR code box |
| `.user-menu-qr-image` | QR `<img>`, pixelated rendering |
| `.user-menu-qr-footer` | "Sync session active" footer text |
