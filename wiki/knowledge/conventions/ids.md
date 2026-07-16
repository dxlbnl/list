---
title: Entity IDs via nanoid
type: pattern
status: accepted
tags: [ids, nanoid, entities, identifiers]
---
All entity IDs (`user.id`, `list.id`, `item.id`, `session.id`) are minted with `nanoid()`, re-exported from `src/lib/utils.ts`. Never use `crypto.randomUUID()` or `Math.random()` for entity IDs. See [data-model](../architecture/data-model.md).

**Why:** IDs are generated client-side first (offline-first — the record exists in Dexie before it reaches Postgres), so a single compact, URL-safe, collision-resistant generator must be used identically on both sides; mixing generators risks format drift and key mismatches across the sync boundary.
