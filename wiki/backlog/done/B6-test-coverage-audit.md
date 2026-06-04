---
id: B6
title: Test coverage audit — where do we actually need tests, prioritized by risk and known bugs
type: research
priority: high
flags: [review]
created: 2026-06-03
report: wiki/research/test-coverage-audit.md
---

## Description

B1 stood up the test infrastructure (Vitest, two projects, pglite harness, zod4-mock
fixtures, CI gate) but the codebase has **no real product tests yet** — only the
infra/harness smoke tests. The user does not want to blast coverage at everything;
they want a **smart audit** that surfaces where tests are actually needed and uses
that to seed the backlog. They also know there are latent bugs and want the audit to
surface those alongside the gaps.

This is a research item: read the code, the wiki, and the user's signals; produce a
prioritized list of test work to file as concrete backlog items.

## The research question

Where in this codebase does the project urgently need tests, ranked by risk × value,
and what latent bugs does the audit surface along the way?

"Risk × value" means: prefer tests that would have caught a known/suspected bug, lock
down a load-bearing invariant (sync correctness, auth, soft-delete preservation),
or harden code about to be refactored (B5 will refactor groups; B4 will fix the
rename). Avoid tests that just chase coverage on trivial getters, framework
boilerplate, or code that's about to be deleted.

## Output (definition of done for the research)

A report at `wiki/research/test-coverage-audit.md` containing:

1. **Triage of the codebase** by area (sync engine, auth + session merging, actions
   layer / Dexie writes, sync CTE on the server, validation transforms, group
   semantics, slug routing, soft-delete restore, rate limiting, supabase JWT signing,
   UI components). For each area, a 1-3 line note on what would be valuable to test
   and what existing structure makes it testable (or not — flag friction).
2. **A prioritized list of proposed test items**, each tagged with:
   - one-line description of what to test,
   - the test tier (`node unit` / `pglite integration` / `browser/Svelte`),
   - the rough scope (single file vs. multi-area),
   - the risk it mitigates / bug it would have caught.
   Ranked **high → low** by risk × value, with a recommended cut line: above the line
   = file as backlog items now; below the line = skip / defer.
3. **A list of latent bugs surfaced during the audit**, separate from the test list,
   with: file:line, what looks wrong, confidence (confirmed by reading code /
   suspected / needs reproduction), and the proposed shape of the fix.
4. **A short "what NOT to test" section** — areas the audit deliberately deprioritized
   and why (one line each). Keeps the bar visible.
5. **A recommended next-step plan** — which items the manager should file from the
   list, in what order, and any sequencing constraints (e.g. "characterize current
   group disappear-on-empty before B5 refactors it").

## Constraints (the "be smart about it" bar)

- A proposed test only earns its place if it would catch a real risk, lock down a
  load-bearing invariant, or buy refactor safety on code that's about to change.
- Use existing infra: `pglite` harness for DB/server, the registered `world` from
  `src/lib/test/fixtures.ts` for fixtures (per the architecture.md Rules — no fixture
  wrappers, no hand-stamped FKs), Playwright/browser tier for component behaviour.
- Read the wiki first: `architecture/sync-engine.md`, `architecture/data-flow.md`,
  `architecture/server-modules.md`, `architecture/client-modules.md`,
  `features/auth.md`, `features/lists.md`, `features/soft-deletes.md`,
  `architecture/conventions.md`, `issues.md`. The audit's job is partly to verify the
  wiki against the code; flag divergences.
- B4 (group-rename quirk) and B5 (persist empty groups) are already on the backlog.
  The audit shouldn't refile those, but **should** consider whether they need
  expanded test scope, or whether other group-related tests should land *before* them
  for safety.
- This is read-only research — no product code or test code is written here, only the
  report.

## Notes

- Raised by the user 2026-06-03 in response to a question about test scope: "we have
  no tests atm, we just setup the infra for it. we need to check the codebase, and see
  where tests are needed. I do know we have bugs though." Earlier in the same turn:
  "be smart about it. write tests we should have. don't just test just because."
- `flags: [review]` so the manager pauses for user approval of the prioritized list
  before mass-filing items from it.
- After approval, the manager files the chosen items as discrete `bug` / `feature` /
  `chore` cards in `wiki/backlog/inbox/`, each going through the normal tests-first
  pipeline.
