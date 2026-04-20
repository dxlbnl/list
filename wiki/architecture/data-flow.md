# Data Flow

End-to-end description of how data moves through the app — from a user action to persistence and back to collaborators.

→ See also: [Client Modules](client-modules.md) | [Sync Engine](sync-engine.md) | [Data Model](data-model.md)

---

## Write Path (user makes a change)

```
User interaction (click / keypress)
        │
        ▼
  actions.ts  ← THE ONLY allowed mutation entry point
        │
        ├─► db.items / db.lists (Dexie write)
        │         │
        │         ▼
        │   liveQuery subscription fires
        │         │
        │         ▼
        │   Component re-renders instantly (optimistic)
        │
        └─► db.syncQueue.add(SyncOperation)
                │
                ▼
        syncManager.processQueue()
                │
                ▼
        POST /api/sync  { operations: SyncOperation[] }
                │
                ▼
        Server: Drizzle batch upsert/delete → Postgres
                │
                ├─► syncHub.emit('user:{userId}')
                │         │
                │         ▼
                │   SSE listeners on /api/sync GET notified
                │         │
                │         ▼
                │   Other connected clients pull updated data
                │
                └─► Response: { results: [{ id, status }] }
                        │
                        ▼
                Successful op ids deleted from syncQueue
```

---

## Read Path (receiving an update from another client)

```
SSE message arrives on EventSource
        │
        ▼
syncManager (connectSSE handler)
        │
        ├─ { listId: 'global' }
        │       └─► reconcileAllLists()  → GET /api/lists
        │
        ├─ { listId, deleted: true }
        │       └─► db.lists.delete(listId)
        │           db.items.where('listId').equals(listId).delete()
        │
        ├─ { listId, list, items }   ← inline snapshot (no extra fetch)
        │       └─► pull(listId, snapshot)
        │
        └─ { listId }  (no data)
                └─► pull(listId)  if subscribed, else reconcileAllLists()
```

---

## Sources of Truth

| Layer | Source of truth for | Rationale |
|---|---|---|
| Dexie (IndexedDB) | UI rendering | Instant reactivity via `liveQuery`; works offline |
| Postgres | Persistence + sharing | Authoritative for all users |

The UI **never** reads directly from the server on page load. All data is served from Dexie. The sync engine keeps Dexie aligned with Postgres in the background.

---

## Conflict Resolution

Handled inside `syncManager.pull()`:

1. **Pending ops win**: If a local item has an entry in `syncQueue`, it is never overwritten by server data — the local version is considered "in-flight" and authoritative.
2. **Server timestamp wins** (for non-pending items): A server item is accepted only if `serverUpdatedAt > localUpdatedAt`.
3. **Server deletions propagate**: Local items not present in the server response (and not pending) are deleted from Dexie.
4. **List-level conflicts**: Lists are reconciled on name change only (no timestamp comparison). List metadata is less frequently mutated.

---

## Offline Behaviour

- While offline, all mutations still apply to Dexie immediately.
- `syncQueue` accumulates entries.
- On reconnect (`window 'online'` event), the manager runs `processQueue()`, `reconcileAllLists()`, and `pull()` for all active list subscriptions in parallel.
- The SSE connection is re-established automatically by the browser (EventSource reconnects natively).
