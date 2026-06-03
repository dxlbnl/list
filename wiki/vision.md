# Vision

## What is this project?

**List** is an offline-first, real-time collaborative list app. Users create lists,
add and reorder items via drag-and-drop, group them, and share them with others —
with every action taking effect instantly on-device and syncing in the background.

## Why does it exist?

Most list/todo apps stall when the network does: edits block on a round-trip, and
collaboration feels laggy. List writes locally first (IndexedDB) for instant feedback
and reconciles with the server in the background, so the UI never waits on the network.

## Who is it for?

Individuals and small groups who keep shared lists (shopping, tasks, planning) on
phones and desktops, often on flaky connections, and want changes to feel immediate
and to merge cleanly across devices.

## What does success look like?

- Every user action is reflected on-device instantly, with no perceptible wait.
- Concurrent edits from multiple devices converge without lost data.
- A user can lose connectivity, keep working, and have changes sync when back online.
- Sharing a list and transferring a session to another device are frictionless.

## Non-goals

- Not a full project-management tool (no Gantt charts, dependencies, time tracking).
- No OAuth / third-party identity — auth is custom magic-link + anonymous sessions.
- No native mobile apps for now — it is a web app (SvelteKit on Vercel).
- Not a notes/wiki/recipe app — the unit is a list of items.
