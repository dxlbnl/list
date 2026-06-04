---
id: B20
title: Harness — tolerate non-`{items}` responses in `SyncManager.pull` during component tests
type: chore
priority: low
mode: lite
created: 2026-06-04
---

## Description

Surfaced by B7's reviewer. During the new component test
(`src/routes/[slug]/page.svelte.test.ts`), `SyncManager.pull` emits a
benign-but-noisy stderr `TypeError: data.items is not iterable` from
`src/lib/client/sync.svelte.ts:~361` (the line number drifts with the
file; "the `data?.items ?? []` site"). Cause: the test's stubbed `fetch`
returns `[]` for `/api/lists/<id>` instead of the real
`{ list, items: [...] }` shape, and `pull()` iterates `data.items`
without a guard.

The error is caught by the surrounding try/catch — tests still pass and
assertions are unaffected (they read local Dexie state driven through
`actions.ts`, not `pull()`'s output) — but the stderr noise is
misleading. Future readers will second-guess whether the test is
actually working.

## Acceptance

Pick **one** of these (spec-writer / implementer judgement):

- **Option A (preferred — code side):** In `src/lib/client/sync.svelte.ts`,
  guard the iteration: `const items = data?.items ?? []; for (const i of items) { ... }`. One line, behaviour-neutral at runtime (a malformed server response was already a silent failure), eliminates the test noise.
- **Option B (test side):** In `src/lib/test/setup.client.ts` (or the
  page test's setup), provide a smarter `fetch` stub keyed on URL pattern
  that returns `{ list: null, items: [] }` for `/api/lists/<id>` pulls.
  Slightly more involved; the right call if other tests will rely on
  URL-keyed shapes.

After either: `pnpm test --project client` shows no `data.items is not
iterable` line in the test stderr. `pnpm check` / `pnpm lint` /
`pnpm test` stay green.

## Notes

- Audit reference: none — surfaced post-audit by B7's reviewer.
- `mode: lite`: trivially behaviour-neutral (Option A) or test-infra-only
  (Option B). The manager re-checks the gate before honouring lite.
- The exact line in `sync.svelte.ts` drifts; confirm by grep for
  `data.items` at implementation time.
