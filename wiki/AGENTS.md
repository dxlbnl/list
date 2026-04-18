# List App AGENTS Schema

This document defines the rules for how AI agents should interact with and maintain this wiki and the codebase.

## 1. Principles
- **Wiki First**: All major architectural decisions, feature specs, and component behaviors MUST be documented in this wiki *before* implementation.
- **Maintain State**: Update the `log.md` whenever significant changes are made to the codebase or the wiki itself.
- **Cross-Reference**: When creating a new wiki page, link it from `index.md` and related pages.

## 2. Codebase Rules
- **Package Manager**: Use `pnpm` exclusively.
- **UI Components**: Use Svelte + Vanilla CSS. For complex logic, use `Bits UI` headless primitives. Styling MUST be kept inside the component's `<style>` tag, wrapped in a `:global {}` block, and namespaced (e.g., `.list-btn`) to avoid Svelte compiler stripping. Do not use Tailwind.
- **Database**: Drizzle ORM + Neon (Postgres).
- **Offline First**: The frontend must read/write to `Dexie.js` (IndexedDB) natively, and use a queue to push changes to the server.
- **Syncing**: Use Vercel Server-Sent Events (SSE) for pull updates. Ensure robust reconnection handling.
