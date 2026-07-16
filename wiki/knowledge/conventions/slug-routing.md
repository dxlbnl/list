---
title: Slug routing + collision disambiguation
type: mechanism
status: accepted
tags: [slug, routing, url, shared-lists, load, disambiguation]
---
Lists are addressed by `slug`, not `id` — `slugify()` lives in `src/lib/utils.ts`. Reserved slugs (`login`, `settings`, `api`, `confirm`, `list`, `favicon`, `robots`, `static`, `app`) and collisions within a user's own lists get a random suffix. A **shared** list whose slug collides with one the viewer owns is disambiguated as `{slug}--{ownerIdPrefix}` (base slug + leading chars of the owner's user id). `/[slug]/+page.ts` `load()` (SSR disabled) resolves the URL to a `listId` locally from Dexie in order — exact `[createdBy+slug]`, then any accessible list with that slug, then a `--`-split prefix match on `createdBy`, then by id — and only calls `syncManager.reconcileAllLists()` to pull from the server on a miss (e.g. a just-joined list).
That miss-fallback reconcile **must not be gated on the Supabase JWT** — `GET /api/lists` authenticates via
the session cookie, so gating on the (later-arriving) Realtime token made cold/direct link opens 404 until a
refresh. See [data-model](../architecture/data-model.md).

**Why:** two users can independently create lists that slugify identically, so a shared list needs the `--prefix` suffix to stay reachable by a stable URL without colliding with the viewer's own slugs. Resolving from Dexie first keeps navigation instant and offline-capable, hitting the network only when nothing matches.
