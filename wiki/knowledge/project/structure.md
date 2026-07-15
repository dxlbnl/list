---
title: Project structure — routes and src layout
type: reference
status: accepted
tags: [structure, routes, layout, files, sveltekit, directories]
---

```
src/
  lib/
    client/          # Dexie schema (db.ts), local CRUD (actions.ts), sync.svelte.ts, menu/theme runes
    server/          # Drizzle schema (db/schema.ts), auth.ts, supabase-auth.ts, ratelimit.ts (deprecated)
    validations.ts   # Zod schemas — single source of truth for wire/DB/client shapes
    test/            # pglite.ts harness, fixtures.ts (zod4-mock world), setup.{client,node}.ts
    logger.ts        # isomorphic Logger
  routes/
    +layout.svelte / +layout.server.ts / +error.svelte
    +page.svelte                         # home: list grid + create form
    [slug]/+page.svelte  +page.ts        # list detail (ssr disabled); load() resolves slug -> listId
    login/  login/confirm/[token]/  login/confirmed/   # magic-link flow
    logout/  settings/  join/[slug]/[token]/
    api/sync/+server.ts                  # POST: batch CTE processor (push-only; pull is Supabase Realtime)
    api/lists/+server.ts  api/lists/[id]/+server.ts  api/lists/[id]/share/+server.ts
    api/auth/clone/+server.ts            # QR session-clone
    api/logs/+server.ts                  # client log ingest
  service-worker.ts                      # cache-first static, network-first w/ cache fallback
drizzle/                                 # migrations
wiki/                                    # the knowledge graph + backlog + sprint
```

See [client-modules](../architecture/client-modules.md), [server-modules](../architecture/server-modules.md),
and [sync-model](../architecture/sync-model.md) for the moving parts.

**Why:** the split is load-bearing — `lib/client` is the offline-first UI source of truth (Dexie),
`lib/server` is the authority (Drizzle/Neon), and `validations.ts` sits between them as the one shape
definition. `api/sync` is the only complex endpoint; everything else is thin.
