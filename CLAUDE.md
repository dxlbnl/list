# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server on localhost:5173
pnpm build            # Production build
pnpm check            # SvelteKit sync + Svelte type checking
pnpm lint             # ESLint on all files
pnpm test             # Run Vitest (CI mode, --run)
pnpm test:unit        # Run Vitest interactively

# Database (Drizzle + Neon PostgreSQL)
pnpm db:push          # Push schema changes directly (dev)
pnpm db:generate      # Generate migration files
pnpm db:migrate       # Apply pending migrations
pnpm db:studio        # Open Drizzle web studio

# Local Supabase
pnpm supabase:start
pnpm supabase:stop
```

## Architecture

### Offline-First Sync Model

Every user action writes to **IndexedDB (Dexie)** first for instant UI feedback, then a background sync loop pushes queued operations to the server every 10 seconds via a single atomic `POST /api/sync`. The server processes all operations in a single CTE query and Supabase Realtime delivers changes to other connected clients.

```
User Action → IndexedDB (instant) → Sync Queue → POST /api/sync (10s batch) → PostgreSQL CTE → Supabase Realtime → other clients
```

The `SyncManager` in [src/lib/client/sync.svelte.ts](src/lib/client/sync.svelte.ts) owns all sync logic: push queue, pull via Supabase Realtime subscription, reconnection/reconciliation, and SSE timeout handling (Vercel 5-min limit).

### Key Layers

**Client state** lives in [src/lib/client/db.ts](src/lib/client/db.ts) (Dexie schema/instance) and [src/lib/client/actions.ts](src/lib/client/actions.ts) (all local CRUD: `createList`, `addItem`, `reorderItem`, etc.). Components call `actions.ts`, never touch IndexedDB directly.

**Server** uses Drizzle ORM against Neon PostgreSQL. Schema is in [src/lib/server/db/schema.ts](src/lib/server/db/schema.ts). The only complex endpoint is [src/routes/api/sync/+server.ts](src/routes/api/sync/+server.ts) — a single CTE handles all batched operations atomically.

**Authentication** is custom magic-link + anonymous sessions (no OAuth). Flow is in [src/lib/server/auth.ts](src/lib/server/auth.ts). Anonymous users get a session automatically on first visit; magic-link login merges their anonymous data into the verified account. QR code session cloning (`/api/auth/clone`) lets users transfer a session to another device.

**Validation** — all Zod schemas live in [src/lib/validations.ts](src/lib/validations.ts) and are the single source of truth for wire format, DB shape, and client state. Schemas transform between camelCase (client/IndexedDB), snake_case (DB), and JSON (API).

### Routing

- `/` — dashboard, lists grid, live Dexie query
- `/[slug]` — list detail view, SSR disabled (`export const ssr = false`)
- `/login` — magic link form (server action in `+page.server.ts`)
- `/join` — join a shared list via invite token
- `/settings` — user profile settings
- `/api/sync` — core batch sync endpoint
- `/api/lists/[id]/share` — generate invite links
- `/api/auth/clone` — QR session migration

### Data Model Highlights

Items use **float ranks** for O(1) reorder (no index shifting). Deletion is **soft** (`deletedAt` timestamp) — items are recoverable. Shared lists with slug conflicts use a `slug--prefix` URL disambiguation scheme. Rate limiting is implemented in-database via the `rateLimits` table.

### Svelte 5 Runes

The project uses Svelte 5 rune mode (`$state`, `$derived`, `$effect`). Reactive state in `.svelte.ts` files (e.g., `sync.svelte.ts`, `menu.svelte.ts`) is shared across components via module-level rune instances.

## Environment Variables

```env
DATABASE_URL                  # Neon PostgreSQL connection string
RESEND_API_KEY                # Email (magic links)
PUBLIC_SUPABASE_URL           # Supabase project URL
PUBLIC_SUPABASE_ANON_KEY      # Supabase public key
SUPABASE_JWT_SECRET           # ES256 private key for signing Supabase JWTs
SUPABASE_JWT_KID              # Key ID for JWT header
```

Supabase JWT signing is in [src/lib/server/supabase-auth.ts](src/lib/server/supabase-auth.ts) — the server signs a JWT so Supabase Realtime accepts the client's subscription as the authenticated user.
