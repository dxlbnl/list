# Sync Engine & Offline-First Strategy

The application prioritizes local responsiveness and offline availability through a hybrid synchronization model.

## Local Source of Truth: Dexie.js
- All UI interactions read and write to **IndexedDB** via **Dexie.js**.
- This ensures the app is fully functional without an internet connection.
- Mutations are applied locally first (Optimistic UI).

## The Sync Loop

### 1. Egress (Pushing Changes)
- When a local change is made, a `sync_queue` entry is created.
- The `SyncManager` flushes this queue to `/api/sync` in batches.
- Batching ensures $O(1)$ roundtrip performance even for multiple rapid edits.

### 2. Ingress (Pulling Changes)
Real-time updates are handled via **SSE (Server-Sent Events)**, but the implementation must account for serverless constraints.

#### Serverless Constraints (Vercel)
- **Instance Isolation**: Because the app runs on serverless lambdas, memory is not shared between requests. A `POST` sync request may land on Instance A, while the `SSE` connection is held by Instance B.
- **In-Memory Hub**: The `syncHub` (EventEmitter) only broadcasts to clients connected to the *same* lambda instance.
- **Persistent Connection Limits**: SSE connections on Vercel are subject to execution limits and potential interruptions.

#### Recovery & Fallbacks
To ensure consistency despite these constraints, the `SyncManager` implements multiple fallback layers:
- **Visibility Sync**: Whenever the browser tab regained focus (`visibilitychange` event), a full `reconcileAllLists` pull is triggered. This catches any updates missed while the app was in the background or during an instance-isolation gap.
- **SSE "Global" Refresh**: The server emits a `global` refresh signal to the current user's channel upon significant state changes (like merging accounts or deleting lists).
- **Network Recovery**: When the browser's `online` event fires, the engine automatically re-reconciles all active lists.

## Data Reconciliation
- **Last-Write-Wins (LWW)**: Conflicts are resolved using the `updatedAt` timestamp.
- **Slug Collision**: During account merges, if two lists have the same name/slug, the incoming list is automatically renamed with a random suffix (e.g., `groceries-x1a2`) to prevent data loss.
- **Bulk Deletion**: To prevent performance bottlenecks in IndexedDB, list deletions are handled via `bulkDelete` on items using the `anyOf` index for $O(1)$ cleanup.

## Why no external Pub/Sub?
To maintain a zero-dependency, minimal-hosted-solution architecture, we rely on the client's proactive reconciliation (Visibility Sync and Reconnection) rather than adding a third-party real-time provider like Pusher or Redis. This keeps the stack simple (Postgres + SvelteKit) at the cost of "eventual consistency" (seconds) rather than "instant sync" (milliseconds) when crossing serverless instance boundaries.
