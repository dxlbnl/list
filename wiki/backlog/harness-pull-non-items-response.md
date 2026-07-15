---
title: Harness — tolerate non-{items} responses in SyncManager.pull during component tests
type: chore
priority: low
flags: []
created: 2026-06-04
---

## What / why

During the list-page component test (`src/routes/[slug]/page.svelte.test.ts`),
`SyncManager.pull` emits a benign-but-noisy stderr `TypeError: data.items is not iterable`
from `src/lib/client/sync.svelte.ts` (the `data?.items ?? []` site; the line number drifts
with the file). Cause: the test's stubbed `fetch` returns `[]` for `/api/lists/<id>`
instead of the real `{ list, items: [...] }` shape, and `pull()` iterates `data.items`
without a guard.

The error is caught by the surrounding try/catch — tests still pass and assertions are
unaffected (they read local Dexie state driven through `actions.ts`, not `pull()`'s
output) — but the stderr noise is misleading and makes future readers second-guess whether
the test works. Trivially behaviour-neutral (Option A) or test-infra-only (Option B).

## Acceptance

Pick **one**:

- **Option A (preferred — code side):** in `src/lib/client/sync.svelte.ts`, guard the
  iteration: `const items = data?.items ?? []; for (const i of items) { ... }`. One line,
  behaviour-neutral at runtime (a malformed server response was already a silent failure),
  eliminates the test noise.
- **Option B (test side):** in `src/lib/test/setup.client.ts` (or the page test's setup),
  provide a smarter `fetch` stub keyed on URL pattern that returns `{ list: null, items: [] }`
  for `/api/lists/<id>` pulls. Slightly more involved; the right call if other tests will
  rely on URL-keyed shapes.

After either: `pnpm test --project client` shows no `data.items is not iterable` line in
the test stderr; `pnpm check` / `pnpm lint` / `pnpm test` stay green.

## Notes

- Confirm the exact `data.items` site by grep at implementation time — the line drifts.
- The engine is described in [client-modules](../knowledge/architecture/client-modules.md)
  and [sync-model](../knowledge/architecture/sync-model.md); the component-test harness in
  [test-setup](../knowledge/testing/test-setup.md).
