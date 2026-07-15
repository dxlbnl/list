# Vibin v2 — operating rules

This project runs the **Vibin v2** loop: a **wiki of knowledge** drives the work, and ceremony is
proportional to risk. (Fresh clone? Run `/bootstrap` first.)

## The wiki is the source of truth
- `wiki/knowledge/` is a graph of short, linked **atoms** — durable, reusable knowledge. Start at
  `wiki/knowledge/index.md`. **Read the atoms relevant to your task before working** — the knowledge
  gate enforces it (only knowledge reads unlock work). Binding constraints:
  `wiki/knowledge/project/the-rules.md`.
- `wiki/backlog/` holds **work items** (slug-named cards). A card **is** the spec — flesh detail into
  the card, never a separate spec file. Work items are transient: deleted when done, their learnings
  captured as atoms.
- `wiki/sprint.md` is the working state: active tasks + a disposable run log. Resume from it.

## The loop
Run an item with the **`loop`** skill: **retrieve** atoms → **do** it inline (right-sized) →
**verify** → **capture** learnings as atoms → **review** → close (delete the card). There is no
spec-writer / test-writer / implementer relay — you do the work; only **`reviewer`** (independent
check) and **`researcher`** (research → atoms) are separate agents.

## Capture (the keystone)
When a turn changes product code, the capture hook prompts you to record any **durable, reusable**
learning as a knowledge atom (a fault+fix, a non-obvious pattern, a decision) — update the existing
atom if one covers the topic. Routine edits → nothing. Knowledge lives in atoms — **never** Claude's
native memory (it's opaque) and never the run log.

## Rules of thumb
- Use **only** the package manager declared in `the-rules.md` — never substitute.
- Precision lives in tests; prose carries intent. Right-size verification to the project's test policy.
- Links flow **work → knowledge**, never the reverse. One canonical home per fact; replace
  (delete + repoint) when wrong.
- New work mid-task → `/intake` a card; don't inline-patch.
- Keep atoms, cards, and this file short. Don't commit or push unless asked.
- Replace hook scripts by writing over them — never delete-then-recreate (cached hook config
  hard-blocks on a missing script).
