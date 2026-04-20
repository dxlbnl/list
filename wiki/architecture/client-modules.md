# Client Modules

All client-side logic lives in `src/lib/client/`. These modules are browser-only (never imported by server routes).

→ See also: [Data Flow](data-flow.md) | [Server Modules](server-modules.md) | [Data Model](data-model.md)

---

## `db.ts` — Dexie Instance

Defines the `LocalList`, `LocalItem`, and `SyncOperation` interfaces, the `ListDatabase` class (extends `Dexie`), and exports the singleton `db`.

**Rule**: Never access `db` directly from a component. All mutations go through `actions.ts`.

---

## `actions.ts` — Mutation Facade

The **single entry point for all user-initiated data mutations**. Every function:
1. Writes to Dexie immediately (optimistic update → UI refreshes instantly via `liveQuery`).
2. Adds a `SyncOperation` to `db.syncQueue`.
3. Calls `syncManager.processQueue()` to attempt an immediate push.

| Export | What it does |
|---|---|
| `createList(name, userId)` | Slugifies name, checks for local collisions and reserved slugs, inserts list, queues `INSERT` |
| `addItem(listId, name, groupName?)` | Inserts item with `rank = Date.now()`, queues `INSERT` |
| `updateItem(itemId, data)` | Partial update + stamps `updatedAt`, queues `UPDATE` |
| `updateItems(updates[])` | Bulk `bulkPut` + bulk queue entries — all share one timestamp |
| `deleteItem(itemId)` | Sets `deletedAt` (soft delete), queues `UPDATE` |
| `deleteList(listId)` | Hard-deletes list + all its items locally, queues `DELETE` |
| `renameGroup(listId, old, new)` | Bulk-updates all items in group via `updateItems` |
| `deleteGroup(listId, groupName)` | Calls `deleteItem` on each group member |

**Note on group name convention**: `actions.ts` receives the display name (potentially `"GENERAL"`) and strips it to `""` before writing to Dexie. See [Conventions](conventions.md).

---

## `sync.svelte.ts` — SyncManager

A Svelte 5 class with reactive `$state` fields. Exported as singleton `syncManager`. Starts automatically when the module is imported (in `+layout.svelte`).

### Reactive public state (bindable by components)
| Field | Type | Meaning |
|---|---|---|
| `isSyncing` | `boolean` | A batch POST is in-flight |
| `isOnline` | `boolean` | Derived from `navigator.onLine` + SSE connectivity |
| `lastSyncError` | `string \| null` | Last push failure message |

### Key methods

**`processQueue()`** — Reads all entries from `syncQueue`, POSTs them to `/api/sync` as a batch. On success, deletes confirmed entries from the queue. Guards against concurrent calls with `isSyncing`. If more items were queued during the flush, schedules another pass in 100ms.

**`pull(listId, snapshot?)`** — Fetches list + items from `/api/lists/{id}` (or uses a pre-fetched `snapshot` from an SSE message to skip the network round-trip). Reconciles against local state:
- Items with pending `syncQueue` ops are **never overwritten**.
- Server item accepted only if `serverUpdatedAt > localUpdatedAt`.
- Local items absent from server response (and not pending) are deleted.

**`reconcileAllLists()`** — Fetches `/api/lists`, merges all lists. Removes locally-known lists that the server no longer returns (and aren't `isLocalOnly` or pending).

**`subscribeToList(listId)` / `unsubscribeFromList(listId)`** — Tracks which list detail pages are mounted. `subscribeToList` triggers an immediate `pull()`.

**`connectSSE()`** — Opens `EventSource` to `/api/sync?clientId={random}`. Handles three message types:
- `{ listId: 'global' }` → `reconcileAllLists()`
- `{ listId, deleted: true }` → delete list + items from Dexie locally
- `{ listId, list, items }` → `pull(listId, snapshot)` (zero extra network fetch)
- `{ listId }` (no data) → `pull(listId)` if subscribed, else `reconcileAllLists()`

**`startLoop()`** — Background polling loop, runs every 10 seconds as a safety net. SSE handles real-time; the loop catches any missed events.

### Network recovery
On `window 'online'` event, the manager runs in parallel:
- `processQueue()`
- `reconcileAllLists()`
- `pull()` for every active list

---

## `menu.svelte.ts` — MenuState

A tiny `$state` class holding a `contextualSnippet: Snippet | null`.

**Pattern**: The `[slug]` page registers a snippet (Share / Delete menu items) via a Svelte action (`registerContextualMenu`). `UserMenu.svelte` reads `menuState.contextualSnippet` and renders it inside the user dropdown. The action's `destroy()` clears the snippet when the page unmounts.

This allows the user menu to show page-specific actions without prop-drilling or a global store coupling.

---

## `theme.svelte.ts` — ThemeManager

Persists the selected theme (`'light' | 'dark' | 'system'`) in `localStorage`. Applies `data-theme="light|dark"` to `<html>`. Respects `prefers-color-scheme` when set to `'system'`. Uses `$effect.root()` to run the persistence effect outside any component lifecycle.

Exported as singleton `themeManager`. Imported in `+layout.svelte`.
