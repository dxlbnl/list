# Requirements

> These describe the current app at a high level. Detailed behaviour lives in the
> `features/` reference pages; new work is specced per item under `specs/`.

## Functional requirements

- R1: A user can create a list, add items, reorder them via drag-and-drop, and group
  items within a list.
- R2: Every action writes to local IndexedDB (Dexie) first for instant UI feedback,
  then syncs to the server in the background.
- R3: Changes sync to other connected clients in real time (Supabase Realtime), and
  concurrent edits converge without losing data.
- R4: A user can work offline; queued changes push when connectivity returns, with
  reconnection/reconciliation handled automatically.
- R5: Deletion is soft (recoverable) — items carry a `deletedAt` timestamp and can be
  restored.
- R6: Anonymous users get a session on first visit; magic-link login merges their
  anonymous data into the verified account.
- R7: A user can share a list via an invite link, and transfer a session to another
  device via QR code.

## Constraints

- Must run on the Vercel platform; serverless functions cap connection duration
  (~300s), so sync must tolerate SSE/Realtime timeouts and reconnect.
- Package manager is **pnpm** (binding — see `architecture.md`).
- Styling is vanilla CSS with global namespacing — **no Tailwind**.
- All client mutations go through `src/lib/client/actions.ts`; components never touch
  IndexedDB directly.
- Validation schemas in `src/lib/validations.ts` are the single source of truth for
  wire format, DB shape, and client state.

## Assumptions

- Lists are modest in size (typical collaborative shopping/task lists, not thousands
  of items).
- Users may have intermittent connectivity but a working browser with IndexedDB.

## Open questions

- (none recorded yet — add as they arise; the manager may flag related backlog items)
