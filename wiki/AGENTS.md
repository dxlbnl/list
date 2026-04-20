# List App AGENTS Schema

This document defines the rules for how AI agents should interact with and maintain this wiki and the codebase.

## 0. First Read
- **Always read `wiki/codebase.md` before making any code change.** It contains the project identity and route tree.
- Follow the links in `wiki/index.md` for deeper detail on any topic.
- If the wiki seems stale, run the **[Analysis Skill](skill-analyze.md)** to update it from source.

## 1. Principles
- **Wiki First**: All major architectural decisions, feature specs, and component behaviors MUST be documented in this wiki *before* implementation.
- **Maintain State**: Update the `log.md` and `codebase.md` whenever significant changes are made to the codebase or the wiki itself.
- **Cross-Reference**: When creating a new wiki page, link it from `index.md` and related pages.

## 2. Codebase Rules
- **Package Manager**: Use `pnpm` exclusively.
- **UI Components**: Use Svelte + Vanilla CSS. For complex logic, use `Bits UI` headless primitives. Styling MUST be kept inside the component's `<style>` tag, wrapped in a `:global {}` block, and namespaced (e.g., `.list-btn`) to avoid Svelte compiler stripping. Do not use Tailwind.
- **Database**: Drizzle ORM + Neon (Postgres).
- **Mutations**: All client-side data mutations MUST go through `src/lib/client/actions.ts`. Never call `db.*` directly from a component.
- **Offline First**: The frontend must read/write to `Dexie.js` (IndexedDB) natively, and use a queue to push changes to the server.
- **Syncing**: Use Vercel Server-Sent Events (SSE) for pull updates. Ensure robust reconnection handling.
- **Logging**: Use the shared `logger` from `$lib/logger`. Never use `console.log` directly. Call `logger.flush()` before returning from server endpoints.
