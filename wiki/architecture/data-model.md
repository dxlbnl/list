# Data Model

The app maintains two parallel databases: a cloud Postgres database (source of truth for persistence) and a local IndexedDB database (source of truth for the UI).

→ See also: [Data Flow](data-flow.md) | [Sync Engine](sync-engine.md)

---

## Server — Postgres (Drizzle ORM)

Schema file: `src/lib/server/db/schema.ts`

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | nanoid |
| `email` | `text` UNIQUE | null for anonymous users |
| `email_verified` | `boolean` | false until magic link confirmed |
| `created_at` | `timestamp` | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `user_id` | `text` → `users.id` | cascade delete |

Index: `user_id`.

### `magic_links`
| Column | Type | Notes |
|---|---|---|
| `token` | `text` PK | |
| `email` | `text` | null = device-sync clone (not an email flow) |
| `user_id_to_merge` | `text` → `users.id` | the anonymous user to absorb on login |
| `expires_at` | `timestamp` | |

### `lists`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `slug` | `text` | URL-safe name, unique per owner |
| `name` | `text` | |
| `created_by` | `text` → `users.id` | cascade delete |
| `created_at` | `timestamp` | |

Constraints: `UNIQUE(created_by, slug)`. Index: `created_by`.

### `list_users` — shared-access join table
| Column | Type | Notes |
|---|---|---|
| `list_id` | `text` → `lists.id` | cascade delete |
| `user_id` | `text` → `users.id` | cascade delete |

PK: `(list_id, user_id)`. Index: `user_id`.

### `list_invites`
| Column | Type | Notes |
|---|---|---|
| `token` | `text` PK | |
| `list_id` | `text` → `lists.id` | cascade delete |
| `expires_at` | `timestamp` | **null = permanent link** |

### `items`
| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `list_id` | `text` → `lists.id` | cascade delete |
| `name` | `text` | |
| `group_name` | `text` | null/`""` = General group |
| `rank` | `double precision` | float for O(1) reordering |
| `done` | `boolean` | |
| `deleted_at` | `timestamp` | null = active; non-null = soft-deleted |
| `updated_at` | `timestamp` | used for conflict resolution |

Index: `list_id`.

### `rate_limits`
| Column | Type | Notes |
|---|---|---|
| `key` | `text` PK | arbitrary string (e.g. `email:foo@bar.com`) |
| `count` | `integer` | |
| `reset_at` | `timestamp` | |

---

## Client — IndexedDB (Dexie.js)

Schema file: `src/lib/client/db.ts`  
Database name: `ListAppDB` (version 4)

### `lists` table — `LocalList`
```ts
interface LocalList {
  id: string;
  slug: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  isLocalOnly?: boolean;  // true until first successful sync
}
```
Indexes: `slug`, `createdBy`, `[createdBy+slug]`, `createdAt`

### `items` table — `LocalItem`
```ts
interface LocalItem {
  id: string;
  listId: string;
  name: string;
  groupName: string;   // "" = General group
  rank: number;
  done: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
  isLocalOnly?: boolean;
}
```
Indexes: `listId`, `name`, `groupName`, `rank`, `done`, `deletedAt`, `updatedAt`, `[listId+groupName]`

### `syncQueue` table — `SyncOperation`
```ts
interface SyncOperation {
  id?: number;  // auto-increment PK
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  entity: 'list' | 'item';
  entityId: string;
  data: any;
  timestamp: number;
}
```
Indexes: `entityId`, `entity`, `timestamp`

---

## Key Design Decisions

- **`group_name = ""`** is the canonical representation of the "General" group in both Dexie and Postgres. The string `"GENERAL"` is a UI display alias only — never write it to the DB.
- **`deleted_at`** on items implements soft deletion. Items are hidden from the UI when `deletedAt !== null` but remain in the DB and can be restored. See [Soft Deletes](../features/soft-deletes.md).
- **`rank`** is a float (double precision). Reordering uses midpoint values for O(1) inserts without renumbering. Currently simplified to `Date.now()` on insert.
- **`isLocalOnly`** flags records that haven't yet been confirmed by the server. Used to prevent the sync reconciler from deleting them prematurely.
