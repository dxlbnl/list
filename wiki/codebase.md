# Codebase Orientation

Quick orientation for any agent or contributor. Read this first, then follow the links for detail.

---

## Project Identity

| Property | Value |
|---|---|
| Framework | SvelteKit 2 (Svelte 5 Runes) |
| Adapter | `@sveltejs/adapter-vercel` |
| Package manager | `pnpm` |
| TypeScript | Yes |
| CSS | Vanilla CSS — `:global {}` inside `<style>`, no Tailwind |
| UI primitives | Bits UI (headless) |
| Auth | Passwordless — magic sessions + magic email links |
| DB (cloud) | Neon (Postgres) via Drizzle ORM |
| DB (local) | Dexie.js (IndexedDB) — primary UI source of truth |
| Sync | Client push-queue → `/api/sync` POST + SSE pull |
| Logging | Isomorphic `Logger`; Axiom transport in production |
| Service worker | `src/service-worker.ts` — cache-first for static assets, network-first with cache fallback |
| Deployment | Vercel |

---

## Route Tree

```
/ .............. +layout.svelte, +layout.server.ts
├── +page.svelte ............ Home: list grid + create form
├── Header.svelte ........... Layout component (co-located)
├── +error.svelte ........... Global error boundary
├── [slug]/
│   └── +page.svelte ........ List detail: items, groups, DnD, share/delete
│   └── +page.ts ............ load() resolves slug → listId
├── login/ .................. Magic link request flow
│   ├── confirm/[token] ..... Verify email token → create session
│   └── confirmed ........... Success landing
├── logout/ ................. POST: destroys session + clears local DB
├── settings/ ............... Account settings, theme toggle, email merge
├── join/[slug]/[token] ..... Accept list invite via token
└── api/
    ├── sync/+server.ts ..... GET: SSE stream; POST: batch operation processor
    ├── lists/+server.ts .... GET: all lists for current user
    ├── lists/[id]/+server.ts  GET: single list + items
    ├── lists/[id]/share/+server.ts POST: create invite token
    ├── auth/clone/+server.ts POST: create session-clone link (QR sync)
    └── logs/+server.ts ..... POST: client log ingest
```


