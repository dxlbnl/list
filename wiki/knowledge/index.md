---
title: Knowledge — start here
type: index
status: accepted
---

Durable, reusable knowledge for **List** — an offline-first, real-time collaborative list app.
Short, linked **atoms** (one idea each), grouped by subject. Read the atoms relevant to your task
**before** working (the knowledge gate enforces it); capture new learnings here when you finish (the
capture gate prompts you).

## Groups

### project/ — what this is + binding constraints
- [what-it-is](project/what-it-is.md) — offline-first collaborative lists; the why and the non-goals.
- [the-rules](project/the-rules.md) — **binding constraints** (RFC-2119). Read before writing code.
- [structure](project/structure.md) — route tree + `src/` layout.
- [stack](project/stack.md) — the tech choices and why.

### architecture/ — how the system is built
- [sync-model](architecture/sync-model.md) — offline-first write path, batch push, realtime pull, conflict resolution.
- [sync-latency](architecture/sync-latency.md) — where cross-device convergence time actually goes today (the diagnosis).
- [sync-redesign](architecture/sync-redesign.md) — **proposed transport**: fold pull into the push response via a server cursor for <1s, one-trip convergence.
- [sync-merge-model](architecture/sync-merge-model.md) — **proposed merge**: one symmetric per-field LWW-Map applied on both surfaces (not a server-only guard).
- [data-model](architecture/data-model.md) — Postgres (Drizzle) + Dexie schema; float ranks, soft delete, slug disambiguation.
- [client-modules](architecture/client-modules.md) — `actions.ts`, `sync.svelte.ts`, `db.ts`, menu/theme runes.
- [server-modules](architecture/server-modules.md) — the `/api/sync` CTE, `auth.ts`, `supabase-auth.ts`.

### testing/ — the test policy
- [test-setup](testing/test-setup.md) — Vitest two-project (client/server) setup, three tiers, commands, CI.
- [fixtures](testing/fixtures.md) — schema-derived `zod4-mock` world; consume it directly.
- [pglite](testing/pglite.md) — in-process Postgres integration harness.
- [async-sync-testing](testing/async-sync-testing.md) — testing the concurrent/timed sync engine: virtual time, two clients, latency + error budgets.

### domain/ — product behaviour
- [lists](domain/lists.md) — drag-and-drop reorder via float ranks.
- [groups](domain/groups.md) — item grouping and the GENERAL group.
- [auth](domain/auth.md) — magic-link + anonymous sessions, account merge, QR session clone.
- [soft-deletes](domain/soft-deletes.md) — recoverable deletion via `deletedAt`.

### conventions/ — house style
- [css](conventions/css.md) — vanilla namespaced CSS, no Tailwind.
- [bits-ui](conventions/bits-ui.md) — styling headless Bits UI primitives.
- [slug-routing](conventions/slug-routing.md) — `slug--prefix` collision disambiguation.
- [logging](conventions/logging.md) — the shared isomorphic logger + `flush()`.
- [ids](conventions/ids.md) — entity IDs minted with `nanoid()`.
- [design](conventions/design.md) — the "Lab-Bench" aesthetic + design tokens.

## The atom format

```
---
title: <short>
type: principle | mechanism | decision | pattern | reference | question
status: draft | accepted
tags: [<topic>, <topic>]   # the retrieval trigger — matched against work items
---
<2–6 sentences. Link related atoms inline with [label](../group/slug.md).>

**Why:** <the rationale, stated inline; cite sources only as breadcrumbs.>
```

Rules of the graph: **one idea per atom** · **one canonical home per fact** (reconcile, never duplicate)
· link densely (an orphan is invisible) · **replace when wrong** (delete + repoint inbound links) ·
knowledge lives here, **never** in native memory or run logs.
