---
name: analyze-sveltekit-app
description: Analyze a SvelteKit project from source and produce or update its wiki documentation. Run when starting work on a new project or when the wiki may be stale.
applies_to: Any SvelteKit project with a wiki/ directory
---

# Skill: Analyze SvelteKit App

Produces a structured, interconnected wiki from the source code of a SvelteKit project. The output format follows the conventions established in the `list` project wiki.

## When to Run

- Starting work on a SvelteKit project for the first time in a conversation.
- The wiki is missing, incomplete, or suspected stale.
- Significant files have been added, removed, or restructured since the last run.

## Expected Output

A `wiki/` directory with these pages:

| Page | Content |
|---|---|
| `wiki/index.md` | Table of contents linking all pages |
| `wiki/codebase.md` | Project identity table + route tree |
| `wiki/AGENTS.md` | Agent rules and codebase conventions |
| `wiki/skill-analyze.md` | This skill (self-referential) |
| `wiki/architecture/data-model.md` | Postgres + Dexie/local DB schemas |
| `wiki/architecture/client-modules.md` | Client-side state/action modules |
| `wiki/architecture/server-modules.md` | Server modules + hooks |
| `wiki/architecture/data-flow.md` | Write path, read path, conflict resolution |
| `wiki/architecture/conventions.md` | CSS, naming, routing, logging, auth |
| `wiki/components/<name>.md` | One page per complex UI component |
| `wiki/features/<name>.md` | One page per major feature flow |
| `wiki/log.md` | Timestamped record of wiki updates |
| `wiki/issues.md` | Pattern violations (only if found) |

---

## Steps

### 1 — Project Skeleton → `wiki/codebase.md` (identity table)

Read: `package.json`, `svelte.config.js`, `tsconfig.json`, `src/app.css`

Extract:
- Framework + version, adapter, package manager
- Key runtime dependencies (DB, UI, auth, sync libraries)
- CSS strategy (Tailwind / vanilla / SCSS)
- Service worker presence (`src/service-worker.ts`)

### 2 — Route Tree → `wiki/codebase.md` (route tree)

Read: `src/routes/` — recursive directory listing, then read `+page.server.ts` / `+server.ts` per route for auth guards and HTTP methods.

Extract per route:
- Segment type: static / `[param]` / `[[param]]` / `[...param]`
- Files present: `+page.svelte`, `+page.ts`, `+page.server.ts`, `+server.ts`, `+layout.*`, `+error.svelte`
- Load strategy: server / universal / none
- Auth guard present: check for session/user validation in load functions
- HTTP methods exported (GET, POST, DELETE, etc.)

### 3 — Data Model → `wiki/architecture/data-model.md`

Read: `src/lib/server/db/schema.ts`, `src/lib/client/db.ts` (or equivalent)

Extract:
- Each server DB table: columns, types, constraints, indexes, FK relations
- Each local DB table: interface fields, Dexie index spec, schema version
- Design rationale for notable fields (soft-delete, rank/ordering, sync flags)

### 4 — Client Modules → `wiki/architecture/client-modules.md`

Read: All files in `src/lib/client/`

Extract per file:
- Exported functions, classes, singletons
- Public reactive state fields (`$state`)
- DB tables accessed
- Server endpoints called
- Side effects and lifecycle

### 5 — Server Modules → `wiki/architecture/server-modules.md`

Read: All files in `src/lib/server/` (recursive), `src/hooks.server.ts`

Extract per file:
- Exported function signatures and responsibilities
- DB tables touched (read/write/delete)
- Side effects (cookie writes, event emitter, globalThis)

### 6 — Components → `wiki/components/<name>.md`

Read: All `.svelte` files in `src/lib/components/` (recursive)

Extract per component:
- Props (`$props()` destructure + TS types)
- Local state (all `$state`, `$derived`, `$effect` declarations)
- Bits UI / headless primitives used
- State modules imported
- Actions called (from `actions.ts` or equivalent)
- Direct DB access — **flag as anti-pattern**
- Direct `fetch()` calls — **flag if outside the designated mutation module**
- HTML structure (top-level template tree)
- CSS namespace

**Route-co-located components** (e.g. `Header.svelte` in `src/routes/`): document inline in the route description, not as separate pages.

### 7 — Data Flow → `wiki/architecture/data-flow.md`

Synthesize from steps 4 + 5. No new files needed.

Extract:
- Write path (user → mutation module → local DB → sync queue → server)
- Read path (push/SSE → sync manager → local DB → reactive UI)
- Sources of truth per layer
- Conflict resolution algorithm
- Offline / reconnect behaviour

### 8 — Conventions → `wiki/architecture/conventions.md`

Read: `src/app.css`, `src/lib/utils.ts`, `src/hooks.server.ts`, spot-check 2–3 components

Extract:
- CSS rules (`:global {}`, namespacing, token usage)
- Special field value conventions (e.g. `""` = General group)
- Routing conventions (slug generation, reserved slugs, disambiguation)
- Mutation rules (which module is the single allowed entry point)
- Auth tiers
- Logging conventions
- ID generation approach

### 9 — Pattern Detection

Run these greps across `src/`. Report findings inline on the relevant wiki page, or in `wiki/issues.md` if more than 3 are found.

| Check | Pattern | Severity |
|---|---|---|
| Direct DB access in component | `\.db\.` in `.svelte` files | ⚠ Warning |
| Raw `fetch` in component | `fetch\('/api` in `.svelte` files | ⚠ Warning |
| `console.log` usage | `console\.log` in `src/` | ℹ Info |
| `console.error` in components | `console\.error` in `.svelte` files | ⚠ Warning |
| Untyped props | `\$props\(\)` without adjacent TS type | ℹ Info |
| Repeated auth guard | `throw redirect` in ≥3 `+page.server.ts` files | ℹ Info (suggest helper) |
| Magic string literals | Hardcoded DB table names as string literals | ℹ Info |

### 10 — Staleness Cross-Reference

After writing all pages:
- Verify every table in `data-model.md` still exists in `schema.ts`
- Verify every route in `codebase.md` still has a matching directory
- Verify every module in `client-modules.md` still exists

Correct any drift found. Update `wiki/log.md` with a timestamped entry.
