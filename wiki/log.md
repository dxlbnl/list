# Log

Chronological record of major events, decisions, and wiki updates.

## [2026-04-18] ingest | Project Inception & Wiki Scaffolding
- Initialized the wiki structure based on the LLM Wiki pattern.
- Finalized architecture plan: SvelteKit, Neon, Drizzle, Dexie (Offline-First), Vercel SSE (Sync).
- Finalized UI plan: Vanilla global CSS + Bits UI logic. No Tailwind.
- Finalized Auth plan: Magic sessions by default, recoverable via Magic Email Links.
- Fully documented all architectural components and features in the wiki.
- Refined CSS strategy: Global resets in `app.css`, component styles inside `<style>` blocks wrapped in `:global {}` for namespacing.
