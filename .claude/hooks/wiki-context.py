#!/usr/bin/env python3
"""Vibin v2 SessionStart hook.

Injects the wiki entry point AND the knowledge map into context for every session
(including subagents). This is the first retrieval layer: the agent starts knowing
what knowledge exists, so the relevant atoms are one Read away. Kept small — both
indexes are intentionally short.
"""
import os
import sys


def project_dir():
    return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()


def main():
    proj = project_dir()
    wiki_dir = os.path.join(proj, "wiki")
    index = os.path.join(wiki_dir, "INDEX.md")
    know_index = os.path.join(wiki_dir, "knowledge", "index.md")
    backlog = os.path.join(wiki_dir, "backlog")
    sprint = os.path.join(wiki_dir, "sprint.md")

    out = ["# Vibin v2 — the knowledge graph is the source of truth"]

    if os.path.isfile(index):
        with open(index) as fh:
            out.append("## wiki/INDEX.md\n")
            out.append(fh.read().rstrip())
    else:
        out.append(
            "**No wiki yet — run `/bootstrap` to set up the project.** Bootstrap "
            "interviews you, seeds the knowledge graph, scaffolds the stack, and "
            "hands off to the `loop` skill."
        )

    if os.path.isfile(know_index):
        with open(know_index) as fh:
            out.append("\n## wiki/knowledge/index.md (the knowledge map)\n")
            out.append(fh.read().rstrip())

    if os.path.isdir(backlog):
        cards = sorted(f for f in os.listdir(backlog) if f.endswith(".md"))
        if cards:
            out.append("\n## Work items in wiki/backlog/\n")
            out.extend(f"- wiki/backlog/{c}" for c in cards)

    if os.path.isfile(sprint):
        out.append("\n(Current sprint state: wiki/sprint.md)")

    out.append(
        "\n---\nReminder: read the knowledge atoms relevant to your task BEFORE "
        "working — the knowledge gate enforces it. Run work items with the `loop` "
        "skill: retrieve -> do (right-sized) -> verify -> capture -> review -> close."
    )

    sys.stdout.write("\n".join(out) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
