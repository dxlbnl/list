# List Synchronizing App Codebase

## Overview
The application is a collaborative list-making tool built with **SvelteKit**. It allows users to create lists, share a unique URL, and synchronize edits (adding, removing, editing, and reordering items) across peers in real-time.

## Technology Stack
- **Framework**: SvelteKit (Svelte 3) using Node adapter (`adapter-node`).
- **Styling**: Tailwind CSS and PostCSS.
- **Real-time Sync**: Server-Sent Events (SSE) via the Fetch API and `ReadableStream`.
- **Drag and Drop**: `svelte-dnd-action`.
- **Testing**: Playwright for end-to-end testing, Vitest for unit tests.
- **Deployment**: Dockerized (contains `Dockerfile`, `docker-compose.yml`, and Gitlab CI config).

## Architecture

### Backend State Management
The backend handles persistent state in memory and dumps it to disk to prevent data loss.
- **`src/lib/state.server.ts`**: The core data management logic. It maintains a `Map` of lists, where each list is an instance of a `Store`. 
  - Each list's state is stored in `data/<id>.json`.
  - The `Store` handles atomic updates and debounces disk writes (saving to JSON) to prevent file system bottleneck issues under heavy collaborative editing.
  - Contains an `EventEmitter` for pub/sub mechanics.

### API & Real-Time Sync
- **List Creation (`src/routes/+server.ts`)**: Accepts POST requests to create a new list. If a name is missing, it auto-generates one using the `docker-names` library.
- **SSE Stream (`src/routes/[id]/state/+server.ts`)**: Exposes a `GET` handler that returns a `text/event-stream`. It listens to the `EventEmitter` in the state layer and pushes the entire updated state JSON to the client whenever changes occur.
- **Mutations (`src/routes/[id]/state/+server.ts`)**: Exposes `POST`, `PUT`, and `DELETE` handlers to add, update, and remove items respectively.

### Frontend Components
- **Home Page (`src/routes/+page.svelte`)**: Contains a form to create a new list. On creation, it redirects the user to `/<id>`.
- **List View (`src/routes/[id]/+page.svelte`)**: Uses `eventSource.ts` to subscribe to the SSE stream and updates a Svelte store (`$state`) reactively.
- **`List.svelte` & `svelte-dnd-action`**: Handles rendering and sorting. When items are dragged and dropped, it recalculates the `rank` property of the item based on its new neighbors (e.g., midpoint between the previous and next items' rank) to maintain sort order, then fires a `PUT` request via the API layer.
- **`api.ts`**: A thin abstraction wrapper around `fetch` used by the frontend to dispatch list mutations.

## Deployment & Build
The application provides standard Vite/SvelteKit scripts (`dev`, `build`, `preview`) as well as a Docker configuration.
- Running `docker-compose up` will build and start the server, mounting the `data/` directory so state changes are persisted between container restarts.
