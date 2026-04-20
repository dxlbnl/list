# Pattern Violations

This page tracks known violations of project conventions that should be refactored when possible.

## Direct DB Access in Reusable Components

> [!WARNING]
> Reusable components should be "dumb" and receive data via props.

- **`src/lib/components/ui/UserMenu.svelte`**
  - Imports `dexieDb` directly.
  - Violation: Calls `dexieDb.delete()` in `handleLogout`.
  - Recommendation: Move the database clearing logic to a client module (e.g., `src/lib/client/auth.ts`) and call it from the component.

## Raw `fetch` in Components

> [!WARNING]
> All network side-effects should be encapsulated in client modules (actions or dedicated service modules).

- **`src/lib/components/ui/UserMenu.svelte`**
  - Calls `fetch("/api/auth/clone")` directly in `handleSyncDevice`.
- **`src/routes/[slug]/+page.svelte`**
  - Calls `fetch("/api/lists/${data.listId}/share")` directly in `handleShareList`.

## Missing Error Handling

- **`src/lib/client/sync.svelte.ts`**
  - SSE connection failures currently only log to console/Axiom. Should show a UI indicator for permanent disconnection.
