#!/usr/bin/env python3
"""Vibin v2 — capture gate (the keystone).

Automates "capture-before-close": when the agent edits PRODUCT CODE and then tries
to finish, it is prompted once to record any durable, reusable learning as a
knowledge atom under wiki/knowledge/. Knowledge compounds from work instead of
relying on goodwill.

Wired on three events (see settings.json):
  PostToolUse (Write|Edit|NotebookEdit):
    - edit under wiki/knowledge/        -> capture happened: clear the dirty marker.
    - edit under a CODE dir             -> set the dirty marker.
    - anything else (wiki cards, .claude config, root files) -> ignored, so config
      tweaks and card edits never trigger a capture nudge.
  Stop / SubagentStop:
    - stop_hook_active (already nudged)  -> allow.
    - dirty marker set                   -> clear it and block once with the prompt.
    - otherwise                          -> allow.

State: .claude/state/capture/<session>__<actor>.dirty (a flag file). Loop-protected
via stop_hook_active + clear-on-nudge (one nudge per batch of edits, never a loop).

Ops note: replace this script by WRITING OVER it, never delete-then-recreate — the
harness caches hook config per session, and a missing script hard-blocks every tool.
"""
import json
import os
import subprocess
import sys

WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}
# Product code only — the signal for capture. /bootstrap adjusts this to the
# project's actual code dirs (e.g. ("src", "static") for a SvelteKit app).
CODE_DIRS = ("src",)


def proj_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def worktree_knowledge_dirs(proj):
    """Return wiki/knowledge/ paths for all active git worktrees."""
    try:
        result = subprocess.run(
            ["git", "worktree", "list", "--porcelain"],
            capture_output=True, text=True, timeout=5, cwd=proj,
        )
        roots = []
        for line in result.stdout.splitlines():
            if line.startswith("worktree "):
                roots.append(line[9:])
        return [os.path.join(r, "wiki", "knowledge") for r in roots]
    except Exception:
        return []


def tool_target(name, ti):
    if name == "NotebookEdit":
        return ti.get("notebook_path")
    if name in ("Write", "Edit"):
        return ti.get("file_path")
    return None


def is_under(path, root):
    try:
        path = os.path.realpath(path)
        root = os.path.realpath(root)
        return os.path.commonpath([path, root]) == root
    except (ValueError, OSError):
        return False


def dirty_path(proj, data):
    actor = data.get("agent_id") or "main"
    session = data.get("session_id") or "nosession"
    d = os.path.join(proj, ".claude", "state", "capture")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"{session}__{actor}.dirty")


PROMPT = (
    "Vibin capture gate — you changed product code this turn. Before finishing, capture any "
    "DURABLE, REUSABLE learning as a knowledge atom in wiki/knowledge/ (short, linked, one idea; "
    "update an existing atom if one covers the topic — one canonical home). A bug's fault+fix, a "
    "non-obvious pattern, or a design decision belongs there — routine edits do not. Write/update "
    "the atom(s), or state in one line that nothing durable came up, then finish.\n"
)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    proj = proj_dir(data)
    know = os.path.join(proj, "wiki", "knowledge")
    if not os.path.isdir(know):
        sys.exit(0)

    event = data.get("hook_event_name", "")
    dirty = dirty_path(proj, data)

    if event == "PostToolUse":
        name = data.get("tool_name", "")
        if name not in WRITE_TOOLS:
            sys.exit(0)
        target = tool_target(name, data.get("tool_input", {}) or {})
        if not target:
            sys.exit(0)
        target_abs = target if os.path.isabs(target) else os.path.join(proj, target)
        all_know = [know] + worktree_knowledge_dirs(proj)
        if any(is_under(target_abs, k) for k in all_know):
            try:  # capture happened
                os.remove(dirty)
            except OSError:
                pass
        elif any(is_under(target_abs, os.path.join(proj, d)) for d in CODE_DIRS):
            open(dirty, "w").close()  # product code changed -> uncaptured work
        sys.exit(0)

    if event in ("Stop", "SubagentStop"):
        if data.get("stop_hook_active"):
            sys.exit(0)
        if os.path.exists(dirty):
            try:  # nudge once per batch of edits
                os.remove(dirty)
            except OSError:
                pass
            sys.stderr.write(PROMPT)
            sys.exit(2)
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
