# Progress Journal

> Append-only run journal. The `manager` updates this as backlog items move through the
> pipeline, so the whole run is auditable. Newest at the bottom.

## Format

```
## <YYYY-MM-DD HH:MM> — B<n>: <item title>
- <agent>: <what it did> → <outcome>
- ...
- result: <done | escalated | paused for review> — <commit hash if committed>
```

When the manager **pauses** (review checkpoint) or **escalates** (unresolved failure),
it records the reason here AND states it in chat.

---

<!-- entries start here -->

## 2026-06-03 — B1: Establish testing setup (runnable suite + pglite harness + CI)

- manager: filed B1 (chore, infra-only); user locked scope = infra only, DB tests via
  pglite, add CI now; later folded in zod4-mock fixtures (from `validations.ts`) seeding
  the pglite harness (shared data source).
- implementer: added `src/lib/test/{setup.client,setup.node,fixtures,fixtures.spec,pglite,pglite.spec}`,
  `.env.test`, `.github/workflows/ci.yml`; wired `setupFiles` in `vite.config.ts`; devDeps
  `@electric-sql/pglite`, `fake-indexeddb`, `zod4-mock`. Server/node tier green (5 tests),
  `pnpm check` 0 errors. Browser tier blocked locally (chromium download 403) → CI-verified.
- escalation (resolved): `pnpm lint` red on 27 pre-existing product-file errors (outside
  B1 scope). User decided → file B2 + run CI lint non-blocking (`continue-on-error`) pending
  B2. implementer applied the CI/doc change; B2 filed in `ready/`.
- reviewer: PASS — all 6 acceptance points met, no scope creep.
- manager: promoted D1's 3 rules into `architecture.md` Rules (pglite harness, zod4-mock
  fixtures, CI gating with lint-non-blocking-pending-B2).
- result: done — commit `008f76e`

## 2026-06-03 — B2: Clear the ESLint baseline + make CI lint blocking

- manager: filed B2 (chore) from B1's escalation; flagged behavior-adjacent (navigation
  `resolve()`, each-keys) — implementer told to stop+flag any non-trivial fix for promotion.
- implementer: cleared the lint baseline (live count was 20, not the snapshotted 27 —
  `scratch/convert_to_jwk.ts` already deleted; also fixed 2 off-card errors to reach 0).
  Removed dead imports/`handleRenameGroup`; wrapped nav in `resolve()`; added each-keys;
  `any`→`LocalItem[]`. Flipped CI lint to blocking; reconciled D1 + architecture.md.
  `pnpm lint` exit 0, `pnpm check` 0 errors, server tests 5/5.
- reviewer: PASS — every behavior-adjacent fix confirmed neutral (resolve() destinations
  unchanged, each-keys stable, removed fn was dead); no scope creep.
- flag (pre-existing, filed separately): inline `onRename` in `[slug]/+page.svelte` doesn't
  translate `"GENERAL"`→`""` like the removed dead fn did — latent group-rename quirk → inbox.
- result: done — commit `a9bb829`
- manager: paused (user switching to a local editor); filed B3 (relational fixtures, user-
  approved) in `ready/` and B4 (group-rename quirk) in `inbox/`. No further dispatch.

## 2026-06-03 — B3: Make zod4-mock fixtures relational

- manager: resumed from pause. B4 still awaiting user answers (`needs-answers`), skipped.
  B3 (chore, medium) is the only ready item — moved to `doing/`, dispatching chore track
  (`implementer` → `reviewer`, no spec / no tests-first).
- manager: added `Bash(pnpm:*)` + `Bash(git stash:*)` to `.claude/settings.json` so the
  pipeline isn't blocked on per-command permission prompts (user-confirmed scope).
- manager: rewrote the B3 card before dispatch. User reviewed the existing `fixtures.ts`
  (which already has the relational `withSchema` registration from B1's later iteration)
  and rejected the `listFixture()` / `itemFixture()` / `listWithItemsFixture()` wrappers —
  "drop the custom functions, use the real api". The pair-helper was also bypassing the
  relation matcher with a manual `listId` stamp. New acceptance: delete the wrappers,
  export the registered `world`, call sites use `world.generate(...)` (and the library's
  native graph/relation API) directly; no back-compat shims; no manual FK construction
  anywhere in `src/lib/test/**`.
- implementer: rewrote `src/lib/test/{fixtures,fixtures.spec,pglite.spec}.ts` to consume
  `world` directly. Found the native zod4-mock coherent-graph pattern: `world.populate(parent, 1)`
  + `world.generate(z.array(child).length(N))` + `world.registry.pick(parent)` — the
  child's matcher resolves the FK via the registered relation, so no test code stamps
  `listId`. Overrides use the library's `{ overrides: ... }` option. Updated the
  architecture.md fixtures paragraph to match the new shape, logged D2 in decisions.md
  flagging the no-wrappers/no-hand-FK constraint for Rule promotion. `pnpm check`
  0 errors, `pnpm lint` clean, `pnpm test` 4 files / 7 tests green (server 3/6, browser
  1/1 — chromium ran locally this time).
- side-deletion (user-sanctioned, off-card): implementer also deleted stale `scratch/
  diagnose_db.ts` + `scratch/fix_rls.ts` (April 2026 one-off Supabase setup scripts)
  without listing them in its report. User reviewed and kept the deletions (B2 had
  already started clearing `scratch/`). Process note flagged to implementer for next time
  (files-changed list must include deletions).
- reviewer: PASS — all 8 acceptance items met, scope clean, D2 well-formed, recommended
  for Rule promotion.
- manager: promoted D2 to `architecture.md` Rules (no-wrappers / no-hand-FK in test code).
- result: done — commit `ac3515e`

## 2026-06-03 — B4/B5/B6: backlog updates between items

- manager: folded user answers into B4 (default group **is** renameable; `"GENERAL"` is
  the display sentinel for `groupName: ""`; fix the live `onRename` to apply the
  `"GENERAL" → ""` translation the removed dead code did). Cleared `needs-answers`,
  moved B4 to `ready/`.
- manager: filed B5 (persist empty groups + explicit group deletion that moves items —
  including soft-deleted — to the default group) from a separate concern the user
  raised mid-answer. `feature`, medium, `review`-flagged (architectural).
- manager: filed B6 (test coverage audit) from user direction "we have no tests atm,
  we just setup the infra for it. we need to check the codebase, and see where tests
  are needed. I do know we have bugs though" + "be smart about it." `research`, high,
  `review`-flagged. Output target: `wiki/research/test-coverage-audit.md`.

## 2026-06-03 — B6: Test coverage audit

- manager: dispatched B6 to a `general-purpose` researcher. Sequence agreed with user:
  B6 first (audit + prioritized list, user approves the cut line), then B4 (rename
  fix — possibly with expanded scope based on B6 findings), then any test/bug items
  spawned from B6, then B5 (refactor groups with the new safety net in place).
- researcher: produced `wiki/research/test-coverage-audit.md` — triage by area (11),
  12 test items above the cut line + 9 below, 11 latent bugs (8 confirmed, 1 confirmed
  + needs-reproduction, 1 suspected, 1 confirmed perf), what-NOT-to-test, and a
  sequenced next-step plan. Added Research table to INDEX.md; set `report:` on the card.
- reviewer: PASS — spot-checked L1, L2, L7, L9, L10, L11 at file:line and confirmed
  grounded; all 7 PASS criteria met; no scope creep.
- user (review checkpoint, 2026-06-04): approved filing T1-T12 + standalone bug items
  for L1/L2/L10 + a `/wiki-sync` chore + reframe B4 with the L7 finding + also file
  T13-T21 (below cut line, low priority). Two design decisions surfaced in the same
  turn:
  - **D3** (sessions persistent — no `expires_at`): the L9 wiki divergence is a wiki
    bug, not a code bug. The user wants a lightweight login UX with no forced expiry.
  - **D4** (rate limiting → Vercel): T17 dropped; the in-app `ratelimit.ts` +
    `rateLimits` table are superseded and to be removed via a follow-up chore.
- manager: logged D3 + D4 in `decisions.md`; promoted both to `architecture.md` Rules.
  Reframed B4 (now an investigate-or-close item — Branch A fix the real bypass,
  Branch B close invalid; added `flags: [review]`). Moved B6 to `done/`.
- manager (intake pass, 2026-06-04): filed 13 items from the audit per user approval —
  - **B7** (chore, high): characterise current "group disappears when emptied" — **B5 prerequisite** (T4).
  - **B8** (bug, high, review): sync CTE INSERT+UPDATE data loss (T1/L1).
  - **B9** (chore, high, review): `mergeUsers` transaction wrap + lockdown (T5/L10).
  - **B10** (bug, medium, review): sync CTE `upsert_lists` authz hole (T2/L2).
  - **B11** (bug, high, review): slug-collision sync-batch failure (T9+T10/L5).
  - **B12** (chore, medium): CTE invariant safety net — LWW + soft-delete preservation + validator drop-undefined (T6+T7+T8).
  - **B13** (chore, medium): sync engine invariant safety net — pending-wins + reconciliation (T11+T12).
  - **B14** (chore lite, low): replace `console.error` in `supabase-auth.ts` with shared logger (L4).
  - **B15** (chore, high, review): `/wiki-sync` to reconcile L3 (SSE→Realtime) + L9 (sessions.expires_at — see D3) + CLAUDE.md rate-limit note (D4).
  - **B16** (chore, medium, review): remove in-app rate limiting (D4 follow-up — `ratelimit.ts`, `rateLimits` table, callers, migration).
  - **B17** (research, low, review): reorder strategy — midpoint floats vs accept renumber (L6).
  - **B18** (research, low, review): soft-delete restore UX — build or remove the wiki claim (L8).
  - **B19** (chore, low): pick-and-fold bucket for T13-T21 (below-cut-line low-value tests; T17 dropped by D4).
- result: done — commit pending (this commit closes B6 + decisions + B4 reframe + the 13 new cards)
