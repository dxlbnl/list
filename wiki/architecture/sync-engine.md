# Sync Engine & Offline-First Strategy

The application prioritizes local responsiveness and offline availability.

## Local Source of Truth: Dexie.js
- All UI interactions read and write to **IndexedDB** via **Dexie.js**.
- This ensures the app is fully functional without an internet connection.
- Mutations are applied locally first (Optimistic UI).

## The Sync Loop

### 1. Egress (Pushing Changes)
- When a change is made locally, it is added to a `sync_queue` in IndexedDB.
- An background process attempts to flush this queue to the SvelteKit CRUD endpoints.
- If a request fails (offline), it remains in the queue and retries when the `online` event fires.

### 2. Ingress (Pulling Changes)
- The app opens an **SSE (Server-Sent Events)** stream to Vercel.
- The server pushes delta updates or notifications of changes.
- **Handling Timeouts**: Since Vercel Edge functions timeout after 300s, the client includes robust reconnection logic.
- **State Reconciliation**: Upon reconnection, the client fetches a "checkpoint" (the latest `updated_at` timestamp from the local DB) and requests all changes from the server since that time to fill gaps.

## Conflict Resolution
- We use a **Last-Write-Wins (LWW)** strategy based on the `updated_at` timestamp.
- Since this is a personal/small group grocery list app, more complex CRDTs are avoided for simplicity.
