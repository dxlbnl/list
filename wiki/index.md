# List App Wiki Index

## 🗂 Start Here
- [Codebase Outline](codebase.md) — Project identity, route tree. Read before anything else.
- [Analysis Skill](skill-analyze.md) — How to analyze the app and update the wiki. Run when the codebase changes.
- [AGENTS Schema](AGENTS.md) — Rules and conventions for AI maintainers.
- [Log](log.md) — Chronological record of major changes.
- [Issues](issues.md) — Known pattern violations and refactoring targets.

## Architecture
- [Data Model](architecture/data-model.md) — Postgres schema (Drizzle) + Dexie local schema.
- [Data Flow](architecture/data-flow.md) — Write path, read path, conflict resolution, offline behaviour.
- [Client Modules](architecture/client-modules.md) — `actions.ts`, `sync.svelte.ts`, `menu`, `theme`.
- [Server Modules](architecture/server-modules.md) — `auth.ts`, `ratelimit.ts`, `syncHub`, hooks.
- [Sync Engine](architecture/sync-engine.md) — Offline-first architecture overview.
- [Conventions](architecture/conventions.md) — CSS, group naming, slug routing, logging, IDs.
- [Design Philosophy](architecture/design-philosophy.md) — "Lab-Bench" aesthetic and design tokens.
- [Component Extraction](architecture/component-extraction.md) — Candidates for UI reuse.
- [Technology Stack](architecture/stack.md) — Core dependency choices.

## Components
- [ListGroup](components/list-group.md) — Group container with DnD, collapsible, and dialogs.
- [UserMenu](components/user-menu.md) — Avatar, sync status, nav dropdown, contextual actions.
- [Styling Bits UI](components/bits-ui-styling.md) — How to style headless Bits UI primitives.

## Features & Flows
- [Authentication](features/auth.md) — Magic sessions and email-based account merging.
- [List Management](features/lists.md) — Drag-and-drop, float ranking, groups.
- [Soft Deletes](features/soft-deletes.md) — Restoring items via restore UI.
