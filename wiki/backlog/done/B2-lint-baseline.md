---
id: B2
title: Clear the ESLint baseline (27 pre-existing errors) and make CI lint blocking
type: chore
priority: medium
created: 2026-06-03
---

## Description

B1 added a gating CI workflow but found **27 pre-existing ESLint errors** in product code
that predate the test-infra work. To keep B1 scoped, CI currently runs `pnpm lint`
**non-blocking** (`continue-on-error`). This item clears the baseline so `pnpm lint` is
green, then flips CI's lint step back to **blocking** (removes `continue-on-error`).

## Acceptance (definition of done)

1. `pnpm lint` exits 0 (all 27 errors resolved).
2. `.github/workflows/ci.yml` — remove `continue-on-error` from the **Lint** step so it
   gates again; drop the `# Non-blocking until B2 …` comment.
3. `pnpm check` and `pnpm test` remain green (no regressions from the fixes).
4. Reconcile the docs: update `wiki/decisions.md` D1 bullet 3 + the proposed Rules line,
   and `wiki/architecture.md`, so they state CI gates `check`/`lint`/`test` (lint no longer
   "pending B2"). The manager promotes the now-unconditional CI rule to Rules on completion.

## The 27 errors (from `pnpm lint`, 2026-06-03)

**Unused vars/imports** (`@typescript-eslint/no-unused-vars`):
- `scratch/convert_to_jwk.ts:126` — `_p`, `_s`, `_d`, `_u`
- `src/lib/server/email/templates/MagicLinkEmail.svelte:10-11` — `Section`, `Column`
- `src/lib/server/ratelimit.ts:3` — `eq`
- `src/routes/join/[slug]/[token]/+server.ts:6` — `nanoid`
- `src/routes/settings/+page.svelte:2` — `enhance`
- `src/routes/[slug]/+page.svelte:179` — `handleRenameGroup`
- `vite.config.ts:4` — `basicSsl`

**`svelte/no-navigation-without-resolve`** (href/goto must use `resolve()`):
- `src/routes/+error.svelte:27`; `src/routes/+page.svelte:63`; `src/routes/Header.svelte:12`
- `src/routes/[slug]/+page.svelte:206` (goto), `:334` (href)
- `src/routes/login/confirmed/+page.svelte:13` (goto), `:34` (href)

**`svelte/require-each-key`** (each block needs a key):
- `src/routes/+page.svelte:60`; `src/routes/settings/+page.svelte:60`

**`@typescript-eslint/no-explicit-any`**:
- `src/routes/[slug]/+page.svelte:107`

## Notes / cautions

- This is lint-only and **intended behavior-neutral**, but two categories touch real
  behavior surface: `no-navigation-without-resolve` (wrapping `href`/`goto` in `resolve()`)
  and `require-each-key` (adding a key changes reconciliation). The reviewer must confirm
  no behavior change — if a fix turns out non-trivial (e.g. `resolve()` needs route typing,
  or a key choice affects DnD/reorder), the manager **auto-promotes this to a full item**.
- `scratch/convert_to_jwk.ts` is a throwaway script — consider deleting it rather than
  fixing, if it's truly unused (confirm first).
- `vite.config.ts:4 basicSsl` unused: B1 left this; remove the import (and any dead usage).
- Do `pnpm lint` (not `--fix` blindly) and review each change; some autofixes for Svelte
  navigation rules are not safe.

## Out of scope

- Product unit tests, the F1–F8 security findings, and the complexity refactors — separate
  items.
