---
id: B15
title: /wiki-sync — reconcile wiki with current code (L3 SSE, L9 sessions, CLAUDE.md ratelimit)
type: chore
priority: high
flags: [review]
created: 2026-06-04
---

## Description

From B6 audit L3 + L9, plus D3 + D4 follow-up. The wiki has drifted from
the code in several places. The user wants `/wiki-sync` run to bring
it back in line. Confirmed divergences:

- **L3 — Sync engine pages describe an SSE engine that no longer exists.**
  `wiki/architecture/sync-engine.md`, `architecture/data-flow.md` (Read
  Path), and `architecture/server-modules.md` ("syncHub" section) all
  describe `GET /api/sync` SSE + EventSource + an EventEmitter on
  `user:{userId}`. Reality: Supabase Realtime channels in
  `src/lib/client/sync.svelte.ts:115-185`; no GET handler in
  `src/routes/api/sync/+server.ts`; no syncHub module. The top-level
  `architecture.md` already says "Supabase Realtime" — only the detailed
  pages are stale.
- **L9 — Wiki claims `sessions.expires_at` exists.**
  `wiki/architecture/data-model.md` and `architecture/database.md` document
  the column; `src/lib/server/db/schema.ts:10-17` defines `sessions` with
  only `id` and `userId`. **D3** ratified "no expires_at, sessions
  persist". The wiki must be updated to reflect this — remove the
  `expires_at` references and document the no-expiry design.
- **CLAUDE.md "Data Model Highlights"** describes in-DB rate limiting via
  the `rateLimits` table. **D4** ratified "rate limiting → Vercel". The
  CLAUDE.md line needs to be reconciled (and will need a follow-up update
  once B16 removes the dead code).

## Acceptance

1. Run `/wiki-sync` (or do the equivalent reconciliation by hand) on the
   pages listed above. Each page reflects the actual code, the actual
   architecture, and the ratified decisions (D3 + D4).
2. Specifically: `architecture/sync-engine.md` describes the Supabase
   Realtime model (channels, `postgres_changes`, ES256 JWT signing for
   the client subscription). `data-flow.md`'s Read Path is rewritten;
   the diagram is updated. `server-modules.md`'s `sync.ts` /
   `syncHub` section is removed or rewritten to reality.
3. `architecture/data-model.md` and `architecture/database.md` remove
   `expires_at` from the `sessions` description and add a one-line note
   citing D3 (sessions persist indefinitely; explicit logout only).
4. CLAUDE.md's "Data Model Highlights" updates the rate-limit line to
   cite D4 (Vercel-delegated; in-app code being removed via B16).
5. No code change. No new tests.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` L3 + L9.
- Decisions referenced: D3 (sessions persistent), D4 (rate limiting →
  Vercel).
- **Out of scope** (separate items): L6 reorder design (B17), L8 restore
  UX design (B18), B16 in-app ratelimit code removal. Those need a
  decision or a code change before the wiki can describe them.
- `flags: [review]`: touches many wiki pages; user should approve the
  rewritten architecture/sync-engine.md before it lands.
