---
title: Data model — Postgres + Dexie schemas
type: reference
status: accepted
tags: [data-model, schema, drizzle, dexie, indexeddb, postgres, ranks, reorder, soft-delete, slug, rate-limit]
---

Two parallel stores hold the same shapes (both defined by the Zod schemas in `src/lib/validations.ts` — see [the-rules](../project/the-rules.md)): **Neon Postgres via Drizzle** (`src/lib/server/db/schema.ts`, the persistence authority) and **Dexie/IndexedDB** (`src/lib/client/db.ts`, DB `ListAppDB` v4, the UI source of truth). Client CRUD only ever runs through [actions.ts](client-modules.md); the server merge is the CTE in [server-modules](server-modules.md).

**Tables.** `users` (nanoid id, unique nullable `email`, `email_verified`) · `sessions` (`user_id`, no expiry column — see [auth](../domain/auth.md)) · `magic_links` (token, nullable email, `user_id_to_merge`, `expires_at`) · `lists` (`UNIQUE(created_by, slug)`) · `list_users` (share join, PK `(list_id,user_id)`, presence = full edit) · `list_invites` (token, nullable `expires_at` = permanent) · `items`. Dexie mirrors `lists`/`items` plus a `syncQueue` table (`++localId` auto-PK) of pending [SyncOperations](sync-model.md).

**Design invariants:**
- **Float `rank`** (`double precision`): reorder writes a midpoint between neighbours for O(1) inserts with no renumbering. See [lists](../domain/lists.md). (Insert currently seeds `rank = Date.now()`.)
- **Soft delete**: `deleted_at` timestamp; null = active, non-null = hidden-but-recoverable. Never hard-delete item data. See [soft-deletes](../domain/soft-deletes.md).
- **General group**: `group_name = ""` is the canonical empty-group value in both stores; `"GENERAL"` is a UI-only display alias, never persisted. See [groups](../domain/groups.md).
- **Slug collisions** on shared lists resolve by a `slug--prefix` URL scheme; merge-time slug clashes get a random `-xxxx` suffix. See [slug-routing](../conventions/slug-routing.md).
- **`isLocalOnly`** (Dexie only) marks rows not yet server-confirmed so reconciliation won't prematurely delete them.
- **`updated_seq` cursor** (`bigint` on `items` + `lists`, server-assigned via the `sync_seq` sequence, bumped on every upsert in the CTE) — the sync **cursor** (what a client has seen), distinct from the LWW stamp. `lists` also gained `updated_at`. `/api/sync` returns the member-visible rows with `updated_seq > cursor`. Migration `drizzle/0001`. See [sync-redesign](sync-redesign.md), [server-modules](server-modules.md).
- **No sync cursor column yet.** `items` has `updated_at` (client wall-clock, used for LWW) but `lists` has only `created_at` — no `updated_at`, no monotonic version anywhere. The [sync-redesign](sync-redesign.md) proposes an additive server-assigned `updated_seq bigint` (+ `updated_at` on `lists`) so a push can return a delta of rows changed since the client's cursor.
- **`rate_limits` table — DEPRECATED.** Rate limiting MUST be delegated to Vercel per [the-rules](../project/the-rules.md); the table plus `ratelimit.ts` are slated for removal (still referenced by `/login`, `/settings`, `/api/auth/clone` today).

**Why:** one Zod-defined shape across wire/DB/client keeps the camelCase↔snake_case transforms in a single place; float ranks + soft delete make reorder and undo cheap and non-destructive; the client's extra `isLocalOnly`/`syncQueue` fields exist only to drive offline [sync](sync-model.md).
