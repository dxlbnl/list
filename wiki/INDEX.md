# Wiki Index

**This wiki is the single source of truth for the project. It is the spec.**
Every agent reads this page first, before doing anything else.

## How the workflow uses this wiki

- The `manager` reads `backlog/` to decide what to build next, dispatching on each
  item's `type:` (feature / bug / research / chore).
- `spec-writer` turns a feature/bug backlog item into a testable spec page under
  `specs/`.
- `test-writer` writes failing tests from that spec page; `implementer` makes them
  pass; `reviewer` verifies the result against this wiki.
- When code and wiki disagree, the **wiki wins** — update the wiki (or run `/wiki-sync`).

## Pages (Vibin workflow)

| Page | Purpose |
|------|---------|
| [vision.md](vision.md) | What the project is and why it exists. |
| [requirements.md](requirements.md) | Functional requirements and constraints. |
| [architecture.md](architecture.md) | Tech stack, package manager, test setup, structure, and the binding **Rules** index. |
| [backlog/](backlog/) | Work items, arranged in four lanes (inbox → ready → doing → done). See `backlog/README.md`. |
| [decisions.md](decisions.md) | Append-only decision log (ADR-style). |
| [progress.md](progress.md) | Append-only run journal — what the agents have done. |
| [specs/](specs/) | One detailed spec page per feature/bug. See `specs/README.md`. |

## Research

| Page | Purpose |
|------|---------|
| [research/test-coverage-audit.md](research/test-coverage-audit.md) | B6 — prioritized test work + latent-bug audit (risk × value), seeds the backlog. |

## Existing project reference docs

These pages predate Vibin and remain the **detailed reference** for the codebase.
`architecture.md` above is the short binding index; the pages below hold the depth.

| Page | Purpose |
|------|---------|
| [codebase.md](codebase.md) | Project identity and route tree. |
| [architecture/stack.md](architecture/stack.md) | Core dependency choices. |
| [architecture/data-model.md](architecture/data-model.md) | Postgres (Drizzle) + Dexie local schema. |
| [architecture/data-flow.md](architecture/data-flow.md) | Write path, read path, conflict resolution, offline behaviour. |
| [architecture/sync-engine.md](architecture/sync-engine.md) | Offline-first architecture overview. |
| [architecture/client-modules.md](architecture/client-modules.md) | `actions.ts`, `sync.svelte.ts`, `menu`, `theme`. |
| [architecture/server-modules.md](architecture/server-modules.md) | `auth.ts`, `ratelimit.ts`, `syncHub`, hooks. |
| [architecture/database.md](architecture/database.md) | Database details. |
| [architecture/conventions.md](architecture/conventions.md) | CSS, group naming, slug routing, logging, IDs. |
| [architecture/design-philosophy.md](architecture/design-philosophy.md) | "Lab-Bench" aesthetic and design tokens. |
| [architecture/component-extraction.md](architecture/component-extraction.md) | Candidates for UI reuse. |
| [architecture/component-guidelines.md](architecture/component-guidelines.md) | Component authoring guidelines. |
| [components/list-group.md](components/list-group.md) | ListGroup component. |
| [components/user-menu.md](components/user-menu.md) | UserMenu component. |
| [components/bits-ui-styling.md](components/bits-ui-styling.md) | Styling headless Bits UI primitives. |
| [features/auth.md](features/auth.md) | Magic sessions and email-based account merging. |
| [features/lists.md](features/lists.md) | Drag-and-drop, float ranking, groups. |
| [features/soft-deletes.md](features/soft-deletes.md) | Restoring items via restore UI. |
| [AGENTS.md](AGENTS.md) | Pre-Vibin maintainer conventions (superseded by CLAUDE.md + this wiki). |
| [issues.md](issues.md) | Known pattern violations and refactoring targets. |
| [log.md](log.md) | Chronological record of major changes (pre-Vibin; `progress.md` is the live journal). |
| [skill-analyze.md](skill-analyze.md) | How to analyze the app and refresh these reference pages. |

> The wiki is **open-ended**. Only this `INDEX.md` is structurally required. Add, split,
> and restructure pages as the project grows — just link new pages in a table above.

## Conventions

- **Adding a page**: create `wiki/<name>.md` (or `wiki/specs/<feature>.md`) and add a row
  to a Pages table above so it is discoverable. Unlinked pages are invisible.
- **Backlog items**: live as per-item files under `wiki/backlog/<lane>/B<n>-<slug>.md`.
  Lane = directory (no `status:` field). Each item has a `type:` (feature / bug /
  research / chore) and an optional `flags:` list (`review` to pause for approval,
  `needs-answers` if awaiting user answers on open questions, `blocked` if stuck). File new
  work with `/intake`; see `backlog/README.md`.
- **Spec pages**: live in `specs/`, one per feature/bug, named after the backlog item
  (e.g. `specs/B3-user-login.md`); see `specs/README.md`.
- **Decisions vs progress**: a standing constraint goes in `decisions.md` **and** as a
  one-line rule in `architecture.md`'s Rules section; a one-off note goes in `progress.md`.
