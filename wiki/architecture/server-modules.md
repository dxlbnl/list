# Server Modules

All server-only logic lives in `src/lib/server/`. Never import these from client-side code or `.svelte` files.

→ See also: [Client Modules](client-modules.md) | [Data Flow](data-flow.md) | [Data Model](data-model.md)

---

## `auth.ts`

Handles the two core session operations.

### `getSession(event)`
Reads the `auth_session` cookie, joins `sessions + users` in Postgres, returns `{ session, user }` or `null` if not found (logs a warning if cookie exists but session is missing).

### `createAnonymousSession(event)`
Creates a new `user` row (email: null, email_verified: false) and a `session` row. Sets a far-future (`9999-12-31`) `auth_session` cookie (httpOnly, SameSite: Lax, Secure in production). Every visitor gets a session — no login required to use the app.

Cookie name: `auth_session`

---

## `db/index.ts`

Exports the Drizzle `db` client, connected via `DATABASE_URL`. All server routes import `db` from here.

---

## `db/schema.ts`

Drizzle table definitions. See [Data Model](data-model.md) for the full schema.

---

## `ratelimit.ts`

### `checkRateLimit(key, limit, windowMinutes): Promise<boolean>`
DB-backed rate limiter using the `rate_limits` table. Returns `true` if the request is allowed, `false` if the limit is exceeded (and logs a warning).

- If the window has expired, resets the counter via upsert.
- Otherwise, increments atomically with `sql\`count + 1\``.
- Currently used only on the `/login` route (prevents email spam).

---

## `sync.ts` — SyncHub

A server-side in-process EventEmitter used to broadcast real-time notifications to connected SSE clients.

### Channels
- **`user:{userId}`** — Used to notify a specific user of updates to their lists or shared items. The payload contains the `listId` and optionally the full `list` and `items` snapshots for zero-latency reconciliation.

**HMR safety**: stored in `globalThis` so the same instance survives Vite hot-module reloads in development. Max listeners set to 100.

Consumers: the SSE GET handler attaches a listener to `user:{userId}` on connection open and removes it on connection close. The `/api/sync` POST handler emits to this channel for every user authorized to see the modified lists.

---

## `logger.ts` (server transport)

Retrieves `AXIOM_TOKEN` and `AXIOM_DATASET` from env. Exports `getAxiomClient()`, `getAxiomDataset()`, and `flush()`. Called in `hooks.server.ts` to register the Axiom transport on the shared `logger` singleton.

---

## `hooks.server.ts`

Runs before **every** request. Exports two SvelteKit hooks:

### `handle`
1. Calls `getSession()`. If null, calls `createAnonymousSession()`.
2. Attaches `event.locals.user` and `event.locals.session`.
3. Resolves the request.
4. Logs the request summary: method, path, status, total duration, `tAuth`, `tResolve`, `userId`.
5. Flushes the logger (required before Vercel freezes the serverless function).

### `handleError`
Logs unhandled server errors with path and userId context. Returns a generic `{ message, code }` to the client.

---

## `email/`

Contains email sending logic for magic link delivery. Uses SMTP credentials from env (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). Called by the `/login` route action.
