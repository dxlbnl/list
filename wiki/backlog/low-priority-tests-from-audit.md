---
title: Low-priority tests from the coverage audit — pick-and-fold as appetite allows
type: chore
priority: low
flags: []
created: 2026-06-04
---

## What / why

The test-coverage audit deliberately deferred 9 tests below its cut line because each had
low risk × value (trivial pure functions, cosmetic state holders, presentational component
snapshots). They're filed here as a low-priority pool so they aren't forgotten — but the
manager should NOT spec them one-by-one. Pick them up opportunistically when the
surrounding code is being touched for another reason, or fold them into a related
higher-priority item when it lands.

| Test | Tier | Notes |
|---|---|---|
| `slugify` / `isReservedSlug` pure-function unit tests | node unit | Pair with `slug-collision-sync-batch-failure` if you touch slug logic. |
| `createSupabaseToken` claims/header round-trip | node unit | Defer until a real JWT bug appears. |
| `themeManager` localStorage round-trip | browser | Cosmetic. |
| `menuState` snippet set/clear | node unit | Trivial holder. |
| Logger formatting branches | node unit | Cosmetic, brittle. |
| Email template rendering | node unit | Visual; template changes. |
| `getEffectiveSlug` collision branch | node unit | Pair with `slug-collision-sync-batch-failure`. |
| Component snapshot tests for `Dialog`/`UserMenu`/`InputGroup` | browser | Pure presentational; would rot. |

(A `ratelimit.ts` window-reset test was also in the original pool but is **dropped** — the
in-app rate-limit code is being removed; see `remove-in-app-rate-limiting`.)

## Acceptance

This card is a **bucket** — there's no single "done" state. Fold any of these into the
appropriate related card when it comes up, and close the bucket (with a one-line note
listing which ones were folded in vs. left alone) once the related cards are processed, or
after a defined cooldown if it sits untouched.

## Notes

- The slug-related entries pair naturally with `slug-collision-sync-batch-failure`.
- The dropped rate-limit test's subject is removed by `remove-in-app-rate-limiting`
  (rate limiting → Vercel; see [auth](../knowledge/domain/auth.md)).
- Tiers and harnesses are described in [test-setup](../knowledge/testing/test-setup.md);
  fixtures in [fixtures](../knowledge/testing/fixtures.md).
- This is the kind of card it's reasonable to leave open for months.
