---
title: Server modules — sync CTE, auth, Supabase JWT
type: reference
status: accepted
tags: [server, api-sync, cte, auth, sessions, magic-link, anonymous, supabase-jwt, es256, realtime]
---

Server-only logic in `src/lib/server/` and the API routes; never imported by client code.

- **`POST /api/sync`** (`src/routes/api/sync/+server.ts`) — the only complex endpoint, now a thin wrapper over **`processSyncBatch(db, userId, ops)`** in `src/lib/server/sync.ts` (extracted so the CTE is pglite-testable directly, taking any Drizzle executor). It validates with the Zod `syncRequestSchema`, then applies **all** operations (item/list upserts + deletes) in **one atomic CTE**: input is **coalesced per id** (a same-id INSERT+UPDATE merges, latest non-null per field — no batch data loss), **list INSERT forces `created_by = user.id`** (no ownership spoofing), a concurrent `(created_by, slug)` collision is **renamed** with an id-derived suffix instead of aborting the batch on the UNIQUE violation, upserts enforce `list_users` membership, item upsert is guarded by `updated_at < EXCLUDED.updated_at` (LWW), and it `RETURNING`s written ids so the response reports per-op `success`/`ignored`. One request → one round-trip. It is **push-only — there is no GET/SSE**; pull is Supabase Realtime (see [sync-model](sync-model.md)).
- **`auth.ts`** — custom sessions, no OAuth. `getSession` joins `sessions`+`users` on the `auth_session` cookie. `createAnonymousSession` mints a user+session for every first-time visitor with a far-future (`9999-12-31`) cookie — sessions never expire (see [auth](../domain/auth.md)). `mergeUsers` folds an anonymous user's lists/shares into a verified account on magic-link login, renaming slug collisions with a random suffix. Magic links are emailed via the `email/` module.
- **`supabase-auth.ts` + `GET /api/auth/token`** — `createSupabaseToken(userId)` signs an **ES256 JWT** (`jose`, `SUPABASE_JWT_SECRET`/`_KID`, 1 h TTL, `role: authenticated`, `sub: userId`) so Supabase Realtime accepts the client's subscription as that authenticated user. The client fetches/refreshes it from `/api/auth/token`.
- **`ratelimit.ts`** — DB-backed limiter on `rate_limits`; **deprecated**, rate limiting is delegated to Vercel per [the-rules](../project/the-rules.md) (still wired to `/login`, `/settings`, `/api/auth/clone` — slated for removal). See [data-model](data-model.md).

**Why:** collapsing the whole sync batch into a single authorization-checked, timestamp-guarded CTE gives atomic, one-round-trip persistence; anonymous-first non-expiring sessions plus a short-lived signed JWT let an unauthenticated visitor use the app instantly yet still subscribe to Realtime securely as themselves.
