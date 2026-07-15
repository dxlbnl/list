---
name: intake
description: File a new work item as a card in wiki/backlog/ (v2 — card-is-spec, slug filename, proportional detail). Use whenever the user reports a bug, asks for a feature, or proposes new work mid-task — instead of inline-patching.
disable-model-invocation: false
---

# Intake — file a new work item (v2)

Captures new work as one card in `wiki/backlog/` so the current task continues undisturbed. Safe for
any agent: it writes one new file and touches nothing else.

## Procedure

1. **Name it by slug** — `wiki/backlog/<slug>.md` (lowercase, hyphens, ~40 chars). No numeric ids:
   slug filenames can't collide across branches the way `B<max+1>` did. If a card with that slug
   exists, it's the same topic — update that card instead (one home).
2. **Write the card — the card IS the spec.** Detail is **proportional**: a one-line idea is fine; a
   bug needs what's known of the repro, the suspected fault, and a fix direction. Don't pad.

   ```markdown
   ---
   title: <short imperative title>
   type: feature | bug | research | chore
   priority: high | medium | low
   flags: []            # [review] to pause for user sign-off before work
   created: <YYYY-MM-DD>
   ---

   ## What / why
   <the ask, in the user's voice — plus repro/fault/fix-direction for bugs>

   ## Notes
   <links to relevant knowledge atoms (work → knowledge only), gotchas>
   ```

3. **Link knowledge, don't restate it** — if relevant atoms exist (`wiki/knowledge/`), link them in
   Notes. Never copy atom content into the card.
4. **GitHub-sourced items**: note the issue (`#N`) in the card; the eventual commit says `fixes #N`
   and the card is deleted on close.
5. **Report back**: "Filed `<slug>` (type, priority) in wiki/backlog/."

Rules: one item per invocation; do not start working it; the loop pulls it into the sprint later.
