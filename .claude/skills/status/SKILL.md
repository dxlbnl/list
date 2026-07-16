---
name: status
description: One-screen v2 status — current sprint tasks + run log tail, backlog cards, knowledge-graph size. Read-only.
disable-model-invocation: false
---

# Status (v2) — read-only snapshot

Report, in this order, nothing else:

1. **Sprint** — if `wiki/sprint.md` exists: its open tasks and the last ~5 run-log lines. If not:
   "no active sprint".
2. **Backlog** — list `wiki/backlog/*.md` (title, type, priority, flags). Flag any card marked
   `review` or `blocked`.
3. **Knowledge** — atom count per `wiki/knowledge/<group>/` and the 3 most recently modified atoms
   (`ls -t`).
4. **Working tree** — `git status --short` summary (counts only).

Do not modify anything. Do not start work — that's the `loop` skill.
