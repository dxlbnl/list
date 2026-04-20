# Analysis Skill

A repeatable workflow for an agent to analyze this SvelteKit project and produce or update the wiki from the source code. Run this at the start of a conversation after significant codebase changes, or when the wiki may be stale.

**Output**: Updated wiki pages in `wiki/`.  
**Execution**: Agent reads source files in the order below, extracts structured information, writes wiki pages.

---

## Resolved Conventions

- **Route-co-located components** (e.g. `Header.svelte` in `src/routes/`) are documented inline in the route description, not as separate component pages.
- **Staleness detection**: After writing, cross-reference key wiki pages against the current source. Flag any drift (e.g. a column in `data-model.md` that no longer exists in `schema.ts`). Update `log.md` with findings.

---

## Step 1 — Project Skeleton → `codebase.md`

**Read:** `package.json`, `svelte.config.js`, `tsconfig.json`, `src/app.css` (scan for token names and CSS strategy)

**Extract:**
- Framework version, adapter, package manager
- Key runtime dependencies (DB clients, UI libs, auth, sync)
- TypeScript: yes/no
- CSS strategy (Tailwind / vanilla / SCSS)

**Write:** Identity table in `codebase.md`.

---

## Step 2 — Route Tree → `codebase.md`

**Read:** `src/routes/` — recursive directory listing only (no file content yet)

**Extract per route:**
- Segment type: static / `[param]` / `[[param]]` / `[...param]`
- Files present: `+page.svelte`, `+page.ts`, `+page.server.ts`, `+server.ts`, `+layout.*`, `+error.svelte`
- Load strategy: server / universal / none
- Auth guard: does `+page.server.ts` / `+layout.server.ts` check `locals.user`? (read those files)
- HTTP methods (scan `+server.ts` exports: `GET`, `POST`, `DELETE`, etc.)

**Write:** ASCII route tree in `codebase.md`.

---

## Step 3 — Data Model → `architecture/data-model.md`

**Read:** `src/lib/server/db/schema.ts`, `src/lib/client/db.ts`

**Extract:**
- Each Drizzle table: columns, types, constraints, indexes, FK relations
- Each Dexie interface + table: fields, types, index spec, version
- Design rationale for notable fields (soft-delete column, rank field, `isLocalOnly` flag, etc.)

**Write:** `architecture/data-model.md` — two sections (server + client), design decision callouts.

---

## Step 4 — Client Modules → `architecture/client-modules.md`

**Read:** All files in `src/lib/client/`

**Extract per file:**
- Exported functions, classes, singletons
- Public `$state` fields (reactive surface)
- Dexie tables accessed
- Server endpoints called (`fetch('/api/...')`)
- Side effects (event listeners, loops, `$effect.root`)
- Dependencies on other client modules

**Write:** `architecture/client-modules.md` — one section per module, API table.

---

## Step 5 — Server Modules → `architecture/server-modules.md`

**Read:** All files in `src/lib/server/` (recursive), `src/hooks.server.ts`

**Extract per file:**
- Exported function signatures + what they do
- DB tables touched (read / write / delete)
- Dependencies on other server modules
- Side effects (cookie writes, event emitter setup, globalThis usage)

**Write:** `architecture/server-modules.md` — one section per module.

---

## Step 6 — Components → `wiki/components/`

**Read:** All `.svelte` files in `src/lib/components/` (recursive) and any co-located components in `src/routes/`

**Extract per component:**

| Field | Where to find it |
|---|---|
| Props | `$props()` destructure + TS types |
| Emits / callbacks | Function-typed props |
| Local state | `$state`, `$derived`, `$derived.by` declarations |
| Effects | `$effect` blocks — what they watch and do |
| Bits UI primitives | Imports from `bits-ui` |
| DnD / animation | Imports from `svelte-dnd-action`, `svelte/animate` |
| State modules | Imports from `$lib/client/*.svelte.ts` |
| Actions called | Imports from `$lib/client/actions` |
| Direct Dexie access | Imports of `db` from `$lib/client/db` — **flag if present** |
| Direct `fetch()` calls | `fetch('/api/...')` — **flag if present** |
| HTML structure | Top-level template tree |
| CSS namespace | Root class used in `:global {}` |

**Routing**: Route-co-located components (e.g. `Header.svelte`) → document inline in the route step, not as separate pages.

**Write:** One page per complex component in `wiki/components/`. Simple primitives (Checkbox, Dialog) can be grouped or noted inline.

---

## Step 7 — Data Flow → `architecture/data-flow.md`

**Synthesized from steps 4 + 5.** No additional files needed.

**Extract:**
- Write path: user action → `actions.ts` → Dexie → `syncQueue` → `/api/sync` POST → Postgres → SSE broadcast
- Read path: SSE message → `syncManager` → Dexie → `liveQuery` → UI
- Sources of truth per layer
- Conflict resolution algorithm
- Offline / reconnect behaviour

**Write:** `architecture/data-flow.md` — ASCII flow diagrams + prose.

---

## Step 8 — Conventions → `architecture/conventions.md`

**Read:** `src/app.css`, `src/lib/utils.ts`, spot-check 2–3 components for CSS patterns, `src/hooks.server.ts`

**Extract:**
- CSS conventions (`:global {}`, namespacing, token usage)
- Group name convention (stored `""` vs. displayed `"GENERAL"`)
- Slug routing (reserved slugs, disambiguation, slug → id resolution)
- Mutation rule (`actions.ts` only, no direct DB access in components)
- Auth tiers (anonymous / registered / shared)
- Logging rules (`logger.child()`, `logger.flush()`)
- ID generation (`nanoid` only)

**Write:** `architecture/conventions.md`.

---

## Step 9 — Pattern Detection

Run these searches across `src/`. Report findings inline on the relevant wiki page, or collect in `wiki/issues.md` if there are more than 3.

| Check | Grep pattern | Severity |
|---|---|---|
| Direct Dexie in component | `\.db\.` in `src/routes/` or `src/lib/components/` | ⚠ Warning |
| `fetch` in component | `fetch\('/api` in `.svelte` files | ⚠ Warning |
| `console.log` anywhere | `console\.log` in `src/` | ℹ Info |
| `console.error` in components | `console\.error` in `.svelte` files | ⚠ Warning |
| Untyped props | `\$props\(\)` without adjacent TS interface | ℹ Info |
| Repeated auth guard | Count `throw redirect` in `+page.server.ts` files; suggest helper if ≥ 3 | ℹ Info |
| Magic string table names | `'lists'\|'items'\|'syncQueue'` as literals | ℹ Info |

---

## Step 10 — Staleness Cross-Reference

After writing all pages, perform a quick consistency check:

- Does every table documented in `data-model.md` still exist in `schema.ts`?
- Does every route in the `codebase.md` route tree still have a matching directory in `src/routes/`?
- Does every module listed in `client-modules.md` still exist in `src/lib/client/`?

Flag and correct any drift. Update `wiki/log.md` with a timestamped summary of what was created, updated, or flagged.

---

## Output Checklist

```
[ ] wiki/codebase.md          — identity table + route tree
[ ] wiki/architecture/data-model.md
[ ] wiki/architecture/client-modules.md
[ ] wiki/architecture/server-modules.md
[ ] wiki/architecture/data-flow.md
[ ] wiki/architecture/conventions.md
[ ] wiki/components/<name>.md  — one per complex component
[ ] wiki/log.md                — updated with this run's timestamp
[ ] wiki/issues.md             — only if patterns were detected
```
