---
name: loop
description: Run the Vibin v2 build loop — pull a work item into the sprint, then retrieve → do → verify → capture → review → close, mostly inline. Use to build the backlog or resume work.
---

# The loop — Vibin v2 build cycle

You (the working session) run a work item end to end, **mostly inline**. There is no spec→test→implement
relay: the card is the spec, tests are the spec, and you do the work yourself. Only **review** and
**research** are separate (cold) agents.

## Working state — the sprint
`wiki/sprint.md` is the one working-state file: the sprint's task list + a disposable run log.
- **Resuming**: read `wiki/sprint.md` first — it says what's in flight. Tasks remain → continue them.
  No sprint file or all tasks done → run **Sprint start** (below) before touching any card.
- **Log as you go**: the run log is **append-only** — add one-liners at meaningful steps; never
  overwrite or trim entries mid-sprint (it's the narrative the archive preserves). Put a short
  **Next** pointer just below the Tasks for resumability — not in the log. Knowledge does NOT live here.

## Sprint start — plan, then get the go-ahead
The **sprint boundary is the checkpoint**; the sprint interior is autonomous. Don't plow from "what's
this sprint about?" straight into execution — compose the plan and **hard-pause** for a nod first:
1. **Goal** — settle the one-line sprint goal with the user (a short conversation is fine).
2. **Compose** — pick the candidate cards from `wiki/backlog/` and write the plan **into**
   `wiki/sprint.md`: the goal + the task list (slugs) + rough order. `sprint.md` *is* the plan.
3. **Show + wait** — present the composed sprint (goal, the cards = the workload, order) and **wait for
   an explicit go-ahead** before running any card. The user may swap / drop / reorder. This is the one
   blocking checkpoint per sprint — cheap to eyeball, and a mis-composed sprint is the costliest miss.
4. On go-ahead → run the items (**Per item**, below), interior autonomous until blocked.

## Execute

Now follow the **`run` skill** (`.claude/skills/run/SKILL.md`) for every open task. It covers
per-card execution (retrieve → do → verify → capture → commit → close) and sprint close (retro →
archive → commit). The run skill is the canonical execution spec — don't re-derive it here.

One addition for human-driven loops: if a card has `flags:[review]` or a **real fork** appears
mid-card, pause and discuss with the user before continuing. The run skill is otherwise autonomous.

## Rules
- Knowledge lives in `wiki/knowledge/` atoms — **never** native memory, never the sprint log.
- Links flow **work → knowledge**, never knowledge → work. One canonical home; replace
  (delete + repoint) when wrong.
- New work discovered mid-task → `/intake` a card (slug-named); don't inline-patch.
- Research items → spawn the `researcher` agent (writes atoms, no code).
- Run until blocked **within** an agreed sprint: once the user has OK'd the plan (**Sprint start**),
  keep pulling items until the sprint is done, a `review` card, or a real fork. Composing a *new*
  sprint is itself a boundary — stop and get the go-ahead, don't auto-start the next one.
