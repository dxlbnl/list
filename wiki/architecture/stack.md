# Technology Stack

This document details the core technologies chosen for the List App rewrite.

## Frontend
- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Adapter**: `@sveltejs/adapter-vercel`
- **State Management**: Svelte Stores + [Dexie.js](https://dexie.org/) (for Offline-First persistence).
- **Drag & Drop**: [svelte-dnd-action](https://github.com/isaacHagoel/svelte-dnd-action) (for list reordering and grouping).
- **Logic Primitives**: [Bits UI](https://www.bits-ui.com/) (headless components for accessible UI patterns).

## Backend
- **Platform**: [Vercel](https://vercel.com/)
- **Database**: [Neon](https://neon.tech/) (Serverless Postgres).
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Validation**: [Zod](https://zod.dev/)

## Communication & Sync
- **Updates**: Server-Sent Events (SSE) via Vercel Edge/Serverless functions.
- **Mutations**: Standard RESTful CRUD endpoints (POST, PUT, DELETE).
- **Real-time**: Opportunistic polling/reconnection logic to handle Vercel's connection duration limits (300s).

## Styling
- **Method**: Vanilla CSS + Global Namespacing.
- **Rules**: No Tailwind. Use strict component-based naming (e.g., `.list-item`) in a global `app.css` to ensure compatibility with headless components and avoid Svelte compiler limitations.
