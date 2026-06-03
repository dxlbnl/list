# CLAUDE.md — operating rules

This repository (**List**) runs the **Vibin** workflow: a **wiki-driven, spec-driven,
test-first** multi-agent process. These rules are enforced by hooks in `.claude/` and by
the agent and skill definitions in `.claude/agents/` and `.claude/skills/`. The
project-specific reference for the List codebase is in the second half of this file and
in `wiki/`.

## The wiki is the single source of truth

- `wiki/` is the spec. Detailed feature specs live in `wiki/specs/` as wiki pages —
  there is no separate specs directory.
- **Every agent reads `wiki/INDEX.md` first.** A `PreToolUse` hook enforces this so it
  cannot be skipped; if the wiki has changed since you last read it, re-read the
  affected pages before continuing.
- The wiki is open-ended. Only `INDEX.md` is structurally required; add, split, and
  restructure other pages freely, and link them from `INDEX.md`. The detailed,
  pre-Vibin reference pages (`codebase.md`, `architecture/**`, `features/**`,
  `components/**`) remain linked from `INDEX.md`.
- When code diverges from the wiki, **update the wiki** (or run `/wiki-sync`). The
  `PostToolUse` reminder will nudge you.

## Workflow

1. `/bootstrap` is the new-project entry point (interview, populate the wiki, scaffold a
   stack). **List is already set up**, so the day-to-day entry points are `/manager` (to
   build the backlog), `/intake` (to file new work), and `/status` (to inspect).
2. The top-level session runs the `manager` skill: it reads the wiki + the items in
   `wiki/backlog/{inbox,ready}/`, presents an ordered work plan for approval, then for
   each item dispatches the right track based on the item's `type:`:
   - `feature` → `spec-writer` → `test-writer` → `implementer` → `reviewer`
   - `bug` → same as feature, plus a regression test for the reported failure
   - `research` → `researcher` specialist → reviewer confirms findings
   - `chore` → `implementer` → `reviewer` (no spec, no tests-first)
   - a `feature`/`bug` with `mode: lite` → `implementer` → `reviewer (lite)` (no spec, no
     tests-first) **when it passes the lite gate** (see Operational rules → Lite track)
3. **Tests are always written first** for **full** `feature`/`bug` items. `test-writer`
   writes failing tests from the spec page and confirms red; `implementer` writes the
   minimum code to reach green. (A gate-passing `mode: lite` item is behavior-neutral, so
   there is nothing to assert and no test is written.)
4. An item is **done** when the reviewer passes AND the full test suite is green. The
   manager `git mv`s the item file to `wiki/backlog/done/`, commits one commit per
   completed item (no push), and loops.

## Operational rules

- **Top-level boundary** — the top-level session answers questions and runs the
  `manager` skill to orchestrate the build. Orchestration lives at the top level because
  only the top-level session can spawn subagents. Even so, the top-level session never
  writes product code, specs, or tests itself — every such artifact goes through a
  delegated subagent.
- **Artifact handoff** — subagents do not share a conversation. They communicate only
  through repo + wiki artifacts. Delegation prompts must name the exact files to read
  and write.
- **Triage** — any bug report, feature request, or change of direction surfaced
  mid-run becomes a new item in `wiki/backlog/inbox/` via `/intake`. Never inline-patch
  in response. The capturing agent files the item, tells the user, and continues the
  current item. The only exception is a trivial typo/comment fix adjacent to the
  current item, which is folded into the current item's commit. An **answer to an open
  question** on the current item (including a decision a specialist needs) is *not* new
  work: it is folded into that item's spec (re-dispatch `spec-writer`), never filed via
  `/intake`.
- **Lite track** — a `feature`/`bug` may carry `mode: lite` to skip the spec page and
  tests-first (`implementer` → `reviewer (lite)`), but **only** for a gate-passing,
  behavior-neutral product change: ≤ a handful of files, no new dependency, no schema/API/
  contract change, nothing security-sensitive, and nothing observable that warrants a test.
  The manager re-checks the gate before honoring lite and **auto-promotes to full** if the
  change turns out bigger. A `bug` that fixes real behavior is always full. Lite is never a
  tests-first bypass for real behavior; `chore` is non-product work, `lite` is trivial product
  work.
- **UI verification** — List is a frontend (SvelteKit) project, so a spec's
  `Scenario (UI):` entries are verified in a real browser via a **proper tool** — a
  committed **Playwright** test and/or the **Chrome DevTools MCP** (the reviewer drives the
  running app + captures a screenshot) — **never** ad-hoc `node`/`python` browser scripts.
- **Search with tools, not Bash** — inspect code with the `Grep`/`Glob`/`Read` tools, never
  shelled `grep`/`find`/`rg`/`cat`/`head`/`sed`. The tools are auto-allowed and silent; a
  shelled-out search makes the user approve a permission prompt. Reserve Bash for the project's
  own commands (test runner, `git`) and run them **one per call** — chaining with `;`/`&&`
  usually won't match the permission allowlist as a single prefix, so it prompts too.
- **No ad-hoc `node`/`python` invocations** — agents must not run `node -e ...`,
  `node <oneoff.js>`, `python -c ...`, `python <oneoff.py>`, or similar interpreter
  scripts as ad-hoc investigation or probing tools. The right tool for each pattern:
  - Searching or inspecting code → `Read` / `Grep` / `Glob` (not a node script).
  - Inspecting data files (JSON, CSV, logs) → `Read` (and `jq` via Bash if needed).
  - Probing an external API to check it works → describe the request (curl / fetch /
    endpoint + body) and **ask the user** to run it.
  - Verifying behaviour of the system being built → write a real test through the
    `test-writer` / `implementer` flow, not a throwaway invocation.
  - Mutating environment, CI, build, or local-tool configuration → describe the
    change (file path + exact diff or shell command) and **ask the user** to apply it.
    Committing a config *file* the project owns — `vite.config.ts`, `drizzle.config.ts`,
    `eslint.config.js`, a CI workflow yaml — is fine; that's product code.

  **Exception**: project-owned commands (`pnpm run …`, `pnpm test`, `pnpm check`,
  `pnpm lint`, or a script the project has committed) are fine — those are the
  project's normal operations, not ad-hoc agent work.
- **Package manager** — always use the one declared in `wiki/architecture.md` (**pnpm**).
  Do not substitute another even if generated configs, READMEs, or model priors suggest one.
- **Run until blocked** — the manager works through the backlog without per-item
  check-ins, pausing only on one of three things:
  1. A **review checkpoint** (the initial work plan, or any item flagged `review`).
  2. An **unresolved failure** (retry budget exhausted — see below).
  3. A **reviewer escalation** (second rejection on the same item).
- **Review checkpoints** — the manager pauses and asks the user directly for approval
  for: (1) the initial work plan, always; (2) any item flagged `review` in its card
  frontmatter (`flags: [review]`). Items are flagged by the user or auto-flagged by the
  manager when risky/ambiguous/architecturally significant. Unflagged items never pause.
- **Retry / escalation** — `implementer` gets 3 attempts inside its own loop to reach
  green. If still red, the manager routes the failure context back for one more
  attempt (4th total), then escalates to the user. A `reviewer` rejection loops back to
  `implementer` once with the review notes; a second rejection escalates.
- **Resuming and unblocking** — to resume after a pause, run `/manager` (or `/status`
  to inspect first). To skip an escalated item, edit its frontmatter to add
  `flags: [blocked]` and a one-line reason in `## Notes`, then re-run `/manager`. To
  cancel, `git mv` the item to `wiki/backlog/done/` and add `flags: [cancelled]`.
- **Commits** — one commit per completed item, message references the backlog item id
  (e.g. `B3: add user login`). Never push unless the user asks.
- **Resumability** — the manager's durable state is `wiki/backlog/**` +
  `wiki/progress.md`. A fresh `/manager` invocation reads those and continues.
- **Decisions and rules** — a choice that establishes a **standing constraint**
  (something future work must obey — a dependency/tool, a pattern, an architectural
  boundary) is logged to `wiki/decisions.md` (ADR-style rationale) by the agent that made
  it, *and* surfaced as a one-line RFC-2119 rule in `wiki/architecture.md`'s **Rules**
  section — the binding index agents read before coding. The **manager owns** the Rules
  section: subagents write the rationale and flag the constraint, the reviewer confirms a
  decision exists, and the manager promotes it to a rule when the item is done. Local,
  one-off choices go in `progress.md`, not `decisions.md`.
- **Escalation is visible** — when the manager pauses or escalates, it writes the reason
  to `wiki/progress.md` and states it in chat.
- **Specialist agents** — beyond the four pipeline subagents, the manager may spawn
  ad-hoc `general-purpose` specialists (researcher, security-auditor, designer, …) or
  persist recurring ones as `.claude/agents/*.md`. All specialists obey the same rules:
  read the wiki first, hook-gated, artifact handoff.

## Upgrading the Vibin workflow

This project records the seed commit it is synced to in `.vibin-version`. To pull later
Vibin improvements, run `/migrate-vibin` (diffs `.vibin-version` against `dxlbnl/vibin`
and applies the changes, preserving local customizations).

---

# Project reference — List

> Detailed, codebase-level guidance for List. The depth lives in `wiki/` (see
> `wiki/INDEX.md`); this section is the quick reference.

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
