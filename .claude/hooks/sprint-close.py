#!/usr/bin/env python3
"""Vibin v2 — sprint-close nudge.

Stop hook: the `loop` skill's sprint-close/retro step has no automated trigger
(the capture gate only fires on code edits). This nudges it: when
wiki/sprint.md's task list is non-empty and EVERY task is checked (`- [x]`)
with none still open (`- [ ]`), prompt the agent to run the retro before
finishing — capture learnings as atoms, delete the done cards, ARCHIVE the
sprint (preserve the append-only run log + enrich), then clear the sprint.

This is a NUDGE, the same altitude as the capture gate — one reminder, not a
hard block. The empty/clean sprint (its `- [ ] (pull cards…)` placeholder
counts as open) never nudges. Loop-protected via stop_hook_active: one nudge
per stop cycle, and it self-clears the moment the sprint is trimmed.

Ops note: replace this script by WRITING OVER it, never delete-then-recreate —
the harness caches hook config per session, and a missing script hard-blocks
every tool.
"""
import json
import os
import re
import sys


def proj_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


PROMPT = (
    "Vibin sprint-close — every task in wiki/sprint.md is checked, but the sprint isn't closed. "
    "Run the retro before finishing: (1) capture any durable learnings as knowledge atoms; "
    "(2) delete the completed backlog cards; (3) archive the sprint to "
    "wiki/sprint-archive/NNNN-slug.md — PRESERVE the append-only run log as the spine and enrich it "
    "with the sprint goal, the closed cards, and links to the captured atoms; (4) clear "
    "wiki/sprint.md for the next sprint. The archive is the write-once ledger; the wiki keeps the "
    "learnings. Then finish.\n"
)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if data.get("stop_hook_active"):
        sys.exit(0)

    sprint = os.path.join(proj_dir(data), "wiki", "sprint.md")
    if not os.path.isfile(sprint):
        sys.exit(0)
    try:
        with open(sprint) as fh:
            text = fh.read()
    except OSError:
        sys.exit(0)

    done = len(re.findall(r"^\s*-\s*\[x\]", text, re.MULTILINE | re.IGNORECASE))
    still_open = len(re.findall(r"^\s*-\s*\[ \]", text, re.MULTILINE))

    if done >= 1 and still_open == 0:
        sys.stderr.write(PROMPT)
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    main()
