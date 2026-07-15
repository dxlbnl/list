---
title: Tech stack
type: reference
status: accepted
tags: [stack, sveltekit, svelte5, dexie, drizzle, neon, supabase, zod, bits-ui, resend, vercel, dependencies]
---

- **Language / UI**: TypeScript, Svelte 5 in **rune mode** (`$state`, `$derived`, `$effect`); module-level
  rune instances in `.svelte.ts` files are shared state across components (e.g. `sync.svelte.ts`).
- **Framework**: SvelteKit (`@sveltejs/adapter-vercel`), Vite. Deployed on Vercel.
- **Client storage**: IndexedDB via **Dexie** — the offline-first UI source of truth.
- **Server / DB**: **Drizzle ORM** against **Neon** (serverless PostgreSQL).
- **Realtime**: **Supabase Realtime**; the server signs ES256 JWTs so Supabase accepts the client's
  subscription as the authenticated user (see [server-modules](../architecture/server-modules.md)).
- **Validation**: **Zod** (`src/lib/validations.ts`) — the single source of truth for wire/DB/client shapes.
- **UI primitives**: **Bits UI** (headless) + vanilla namespaced CSS, no Tailwind (see [css](../conventions/css.md), [bits-ui](../conventions/bits-ui.md)).
- **Email**: **Resend** (magic links).
- **Package manager**: **pnpm** (binding — see [the-rules](the-rules.md)).

**Why:** the stack is chosen around offline-first + Vercel's serverless model: Dexie gives instant local
writes, Neon/Drizzle a serverless-friendly authority, Supabase Realtime the fan-out to other clients, and
Zod one shape across all three layers so the camelCase/snake_case/JSON transforms live in one place.
