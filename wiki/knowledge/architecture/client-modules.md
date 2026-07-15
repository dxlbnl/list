---
title: Client modules — actions, sync, db, runes
type: reference
status: accepted
tags: [client, actions, sync-manager, dexie, svelte-runes, mutations, menu, theme]
---

Browser-only modules in `src/lib/client/` (never imported by server routes).

- **`db.ts`** — the Dexie instance (`ListAppDB` v4): `lists`, `items`, and the `syncQueue` table, typed off the Zod schemas. It is the raw store; components MUST NOT touch it directly (see [the-rules](../project/the-rules.md)).
- **`actions.ts`** — the **single mutation path** for all user actions (`createList`, `addItem`, `updateItem(s)`, `deleteItem`, `deleteList`, `renameGroup`, `deleteGroup`, `shareList`). Every mutator writes Dexie first (optimistic; `liveQuery` re-renders), appends a `SyncOperation` to `syncQueue`, then calls `syncManager.processQueue()`. It maps the `"GENERAL"` display alias to the stored `""` group. This is where the [sync-model](sync-model.md) write path begins.
- **`sync.svelte.ts`** — the `SyncManager` Svelte-5 class (singleton `syncManager`, started from `+layout.svelte`) with reactive `$state` (`isSyncing`, `isOnline`, `syncStatus`, `lastSyncError`, `activePulls`). Owns the push queue, the Supabase Realtime subscription, reconciliation, and reconnect/token-refresh. Full behaviour in [sync-model](sync-model.md).
- **`supabase.ts`** — the browser Supabase client used for the Realtime channel.
- **Module-level rune singletons** shared across components without prop-drilling or stores: `menu.svelte.ts` (`menuState.contextualSnippet` — the `[slug]` page registers a Share/Delete snippet via a Svelte action, `UserMenu` renders it) and `theme.svelte.ts` (`themeManager`: persists `light|dark|system` to `localStorage`, stamps `data-theme` on `<html>`, uses `$effect.root()` to live outside any component).

**Why:** funnelling every mutation through `actions.ts` guarantees exactly one optimistic-write-then-enqueue path — the property that makes the app both instantly reactive and reliably syncable — and keeps Dexie access, sync, and shared UI state each in one owned module.
