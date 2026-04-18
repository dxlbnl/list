# List App Codebase (Fresh Version)

## Overview
A high-performance, offline-first collaborative list application built with **SvelteKit 5**. It uses a local-first synchronization strategy where IndexedDB is the primary source of truth for the UI, with background synchronization to a Postgres database.

## Technology Stack
- **Framework**: SvelteKit 5 (using Runes for state management).
- **Database (Cloud)**: Neon (Postgres) managed via **Drizzle ORM**.
- **Database (Local)**: **Dexie.js** (IndexedDB wrapper) for offline-first capabilities.
- **Styling**: Vanilla CSS with a global namespacing strategy ("Lab-Bench" aesthetic). No Tailwind.
- **UI Primitives**: **Bits UI** (headless components) for complex interactions.
- **Auth**: Custom Magic Sessions + Magic Email Links (Passwordless).
- **Sync**: Background queue-based synchronization with conflict resolution via `updated_at` timestamps.

## Architecture

### Offline-First Logic
- **`src/lib/client/db.ts`**: Defines the Dexie schema for local lists, items, and a `syncQueue`.
- **`src/lib/client/actions.ts`**: Frontend business logic that writes to Dexie and queues operations for sync.
- **`src/lib/client/sync.svelte.ts`**: A background manager that periodically pushes the `syncQueue` to the server API.

### Authentication & Sessions
- **`src/lib/server/auth.ts`**: Handles anonymous session creation and magic link verification.
- **`src/hooks.server.ts`**: Ensures every request has a valid session (anonymous by default).
- **`src/routes/login/`**: Handles the magic link email flow and account merging.

### Database & Sync API
- **`src/lib/server/db/schema.ts`**: Drizzle schema for users, sessions, lists, and items.
- **`src/routes/api/sync/+server.ts`**: Batch processing endpoint for client-side operations.

### UI Structure
- **Global Styles (`src/app.css`)**: Contains design tokens and global resets.
- **Home (`src/routes/+page.svelte`)**: Overview of lists and list creation.
- **Detail (`src/routes/list/[id]/+page.svelte`)**: Interactive list view with real-time updates from Dexie.

## Key Features
- **Magic Merging**: Anonymous lists are automatically merged into a user's account upon email verification.
- **Soft Deletes**: Items are marked as deleted but can be restored via a search/restore interface.
- **Precision Ordering**: Rank-based sorting for O(1) reordering.
