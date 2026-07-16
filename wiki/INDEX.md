# Wiki — index

**The knowledge graph is the source of truth.** List is an offline-first, real-time collaborative
list app. Read [knowledge/](knowledge/index.md) and the atoms relevant to your task **before** working
(the knowledge gate enforces it). Work items live in [backlog/](backlog/). The v2 loop and operating
rules are in [`../CLAUDE.md`](../CLAUDE.md).

## Structure

| Where | What |
|---|---|
| [knowledge/](knowledge/index.md) | **Durable, reusable knowledge** — short linked atoms. Start here; binding constraints live in `knowledge/project/the-rules.md`. |
| [backlog/](backlog/) | **Work items** (cards, slug-named). A card *is* the spec — proportional detail, links to knowledge. Transient: deleted when done. |
| [sprint.md](sprint.md) | **Current sprint** — active tasks + a disposable run log. Resume from here. |
| [sprint-archive/](sprint-archive/) | Write-once ledger of closed sprints (run logs preserved at close). |

## How work runs (v2)

Run an item with the **`loop`** skill: retrieve atoms → do it inline (right-sized) → verify → capture
learnings as atoms → review → close (delete the card). Agents: **`reviewer`** (independent check),
**`researcher`** (research → atoms). There is no spec→test→implement relay: the card is the spec, the
tests are the spec, the capture gate makes learning stick.

## Conventions

- One canonical home per fact; links flow **work → knowledge**, never the reverse; replace
  (delete + repoint) when wrong.
- Knowledge in atoms, **never** native memory. Keep atoms and cards short.
- New work mid-task → `/intake` a card; don't inline-patch.
