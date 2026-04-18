# New List App Implementation Plan (Updated)

This document outlines the architecture, database schema, and technology stack for the new "fresh version" of the collaborative list application.

## 1. Technology Stack

*   **Core:** SvelteKit + Vercel Adapter
*   **Database & ORM:** Neon (Postgres) + Drizzle ORM + Zod
*   **Offline Storage:** **Dexie.js** (IndexedDB wrapper to make the app work 100% offline).
*   **UI Components:** Custom Vanilla CSS and Svelte components. Complex logic (like the creatable select) will use **Bits UI** primitives. No Tailwind.
*   **Authentication:** Custom magic sessions + Magic email links. No passwords or OAuth.
*   **Drag & Drop:** `svelte-dnd-action`.
*   **QR Codes:** `qrcode`.

## 2. Architecture: Offline-First & Vercel Sync

We will avoid third-party hosted WebSockets (like Pusher) and instead use **Vercel Server-Sent Events (SSE)** paired with an **Offline-First** local database.

### The Offline-First Sync Loop
1.  **Local Database (Source of Truth for UI)**: The Svelte frontend will read and write strictly to an IndexedDB database (via Dexie.js). This ensures the app works flawlessly when offline.
2.  **Pushing Changes (CRUD)**: When the user makes an edit (add/move/delete), we write it to IndexedDB immediately, then queue a normal HTTP POST/PUT/DELETE to the SvelteKit backend. If the user is offline, the request stays in a local queue and retries when the connection returns.
3.  **Pulling Changes (Vercel SSE)**: We will open a Server-Sent Event (SSE) connection to a Vercel Edge function. The server will push updates down this stream.
4.  **Handling Vercel Timeouts**: Because Vercel kills SSE connections every 5 minutes, the client will automatically reconnect. When it reconnects, it simply fetches a fresh snapshot of the lists/items from the server to ensure no events were missed during the disconnect.

## 3. Global CSS Strategy

> [!NOTE]
> **Styling Custom UI & Bits UI:**
> Because Svelte's compiler eagerly removes "unused" classes inside scoped `<style>` blocks when those classes are only passed down as props to child components (like `<Select.Trigger class="list-select" />`), we will rely on **Global CSS** with strict namespacing.
> 
> All custom styling for UI primitives will be defined in a global stylesheet (e.g., `app.css`). We will use a clear naming convention (like `.list-dropdown`, `.list-btn`, etc.) to prevent collisions, ensuring styles apply correctly to headless Bits UI elements without fighting the Svelte compiler.

## 4. Database Schema (Drizzle + Neon)

*   **`users`**: 
    *   `id` (PK)
    *   `email` (String, Unique, Nullable)
    *   `email_verified` (Boolean)
    *   `created_at` (Timestamp)
*   **`sessions`**:
    *   `id` (PK)
    *   `user_id` (FK to users)
    *   `expires_at` (Timestamp - 2099)
*   **`magic_links`**:
    *   `token` (PK)
    *   `email` (String)
    *   `user_id_to_merge` (FK to users)
    *   `expires_at` (Timestamp)
*   **`lists`**:
    *   `id` (PK, Random short ID or UUID)
    *   `name` (String)
    *   `created_by` (FK to users)
    *   `created_at` (Timestamp)
*   **`list_users`** (For Sharing):
    *   `list_id` (FK to lists)
    *   `user_id` (FK to users)
*   **`items`**:
    *   `id` (PK)
    *   `list_id` (FK to lists)
    *   `name` (String)
    *   `group_name` (String, Nullable)
    *   `rank` (Real/Float)
    *   `done` (Boolean)
    *   `deleted_at` (Timestamp, Nullable)
    *   `updated_at` (Timestamp - Critical for syncing)

## 5. Feature Implementation Strategy

### Authentication & Account Merging
1.  **Magic Session Generation**: Unauthenticated users get a `user` record (no email) and a long-lived `session` cookie.
2.  **Magic Link**: User inputs email. We email them a magic link token.
3.  **Confirmation & Merge**: User clicks link. If the email exists, we merge their anonymous lists into the confirmed account. If not, we update their anonymous account with the email.

### Ordering, Groups, and Soft Deletes
1.  **Rank & Groups**: `svelte-dnd-action` handles dropping. We calculate the new float `rank` and update `group_name`, save to IndexedDB, and send a PUT request to the server.
2.  **Soft Deletes**: Deleting sets `deleted_at = NOW()`.
3.  **Restore UX**: A custom select (built with Bits UI) will query IndexedDB for `deleted_at IS NOT NULL` items. Selecting one nullifies `deleted_at`, restoring it to its original `rank`.

## 6. Execution Steps

1.  **Initialize**: Run SvelteKit scaffolding (`npx sv create`).
2.  **Database**: Setup Drizzle, define the Postgres schema, and connect to Neon.
3.  **Auth & Emails**: Implement magic sessions and the email verification flow.
4.  **Offline Engine**: Setup Dexie.js for IndexedDB on the client and build the queue for offline CRUD.
5.  **Real-time Engine**: Setup Vercel SSE endpoints and the automatic state-reconciliation on reconnect.
6.  **Frontend**: Build the UI components, DND logic, and list views using the global CSS namespacing strategy.
