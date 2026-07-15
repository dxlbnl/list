---
name: run
description: Execute a pre-composed sprint — retrieve, do, verify, capture, commit, close. No planning, no user checkpoints. Used by the loop skill after planning, and by the sprint-runner agent for parallel sprints.
---

# Run — sprint execution

Execute every open task in `wiki/sprint.md` to completion. The sprint is already composed —
go straight to work.

## Per card

1. **Read the card** from `wiki/backlog/<slug>.md` — it is the spec. (The retrieval hook will
   suggest relevant atoms.)
2. **Retrieve** — read the suggested atoms + their links before touching any file. Always read
   `wiki/knowledge/project/the-rules.md`. The knowledge gate blocks work until current knowledge
   is read.
3. **Do it** — write the minimum code that satisfies the card's acceptance criteria. Right-size
   tests to the project's testing policy (from the-rules or testing atoms).
4. **Verify** — run the project's check/test commands. Fix red before closing.
5. **Capture** — write any durable, reusable learning as a knowledge atom (update an existing
   atom if one covers the topic — one canonical home). Routine edits → one-line "nothing durable."
6. **Commit immediately** — stage the files changed for this card (explicit paths — never
   `git add -A`) and commit `<type>(<slug>): <title>`. One commit per card, no exceptions.
7. **Close** — delete the card, tick the task in `wiki/sprint.md`, append one line to the run log.

Repeat for every open task. If a hard blocker appears (missing context, unresolvable dependency,
real fork), log it in the run log and continue with the next card — do not stop the sprint.

## Sprint close

When all tasks are done:

1. **Retro briefly** — what went well, what dragged, what recurred. Durable lessons → atoms;
   recurring failure-shapes → `wiki/knowledge/project/known-issues.md`.
2. **Archive** to `wiki/sprint-archive/NNNN-slug.md` — preserve the run log as the spine,
   enrich with goal, closed cards, and atom links.
3. **Clear `wiki/sprint.md`** for the next sprint.
4. **Commit the close** — stage archive + cleared sprint + any atoms captured in the retro,
   commit `chore(sprint-close): retro + archive NNNN-slug`.

## Rules

- All file paths relative to the project root (or worktree root if running as sprint-runner).
- `git add -A` is never allowed — stage explicit paths only.
- Knowledge lives in atoms, never the run log.
- New work discovered mid-card → `/intake` a card; do not inline-patch.
