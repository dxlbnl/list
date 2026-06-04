---
id: B19
title: Low-priority tests from B6 audit (T13-T21) — pick-and-fold as appetite allows
type: chore
priority: low
created: 2026-06-04
---

## Description

The B6 audit deliberately deferred 9 tests below its cut line because
each had low risk × value (trivial pure functions, cosmetic state
holders, presentational component snapshots). The user opted to file
them anyway as a low-priority pool so they aren't forgotten — but the
manager should NOT spec them one-by-one. Pick them up opportunistically
when the surrounding code is being touched for another reason, or fold
them in when a related higher-priority item lands.

| Audit ID | Test | Tier | Notes |
|---|---|---|---|
| T13 | `slugify` / `isReservedSlug` pure-function unit tests | node unit | Pair with B11 if you touch slug logic. |
| T14 | `createSupabaseToken` claims/header round-trip | node unit | Defer until a real JWT bug appears. |
| T15 | `themeManager` localStorage round-trip | browser | Cosmetic. |
| T16 | `menuState` snippet set/clear | node unit | Trivial holder. |
| T17 | `ratelimit.ts` window-reset CASE branch | pglite | **Dropped** by D4 — code being removed via B16. |
| T18 | Logger formatting branches | node unit | Cosmetic, brittle. |
| T19 | Email template rendering | node unit | Visual; template changes. |
| T20 | `getEffectiveSlug` collision branch | node unit | Pair with B11. |
| T21 | Component snapshot tests for `Dialog`/`UserMenu`/`InputGroup` | browser | Pure presentational; would rot. |

## Acceptance

This card is a **bucket**. There is no single "done" state. The manager
folds any of T13–T20 (T17 is dropped — see B16) into the appropriate
related card when it comes up, and closes B19 (move to `done/` with
`flags: [cancelled]` and a one-line note listing which ones were folded
in vs. left alone) once the related cards are processed — or after a
defined cooldown if the bucket sits untouched.

## Notes

- Audit references: `wiki/research/test-coverage-audit.md` T13–T21.
- T17 is **dropped** because D4 deletes the subject (in-app rate
  limiting → Vercel; see B16).
- This is the kind of card it's reasonable to leave open for months.
