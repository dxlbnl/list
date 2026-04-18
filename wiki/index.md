# List App Wiki Index

This is the central catalog of all documentation for the List App rewrite.

## Administration
- [AGENTS Schema](AGENTS.md) - Rules and conventions for LLM maintainers.
- [Log](log.md) - Chronological record of ingests and major codebase changes.

## Architecture & Stack
- [Technology Stack](architecture/stack.md) - Core choices: Vercel, Neon, Drizzle, Dexie, SvelteKit.
- [Database Schema](architecture/database.md) - Drizzle table definitions.
- [Sync Engine](architecture/sync-engine.md) - Offline-first architecture (Dexie + Vercel SSE).

## Features & Flows
- [Authentication](features/auth.md) - Magic sessions and email-based recovery merging.
- [List Management](features/lists.md) - Drag-and-drop, float ranking, groups.
- [Soft Deletes](features/soft-deletes.md) - Restoring items via custom select UI.

## Components
- [Global CSS Strategy](components/css-strategy.md) - Using Vanilla CSS namespacing alongside Bits UI.
