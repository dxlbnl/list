#!/usr/bin/env python3
"""Vibin v2 knowledge gate (read-before-work).

Every actor must read the CURRENT knowledge graph before it writes project files,
runs non-trivial Bash, or spawns agents. Only reads under wiki/knowledge/ (or of
wiki/INDEX.md) unlock the gate — reading a backlog card is not retrieval.

PreToolUse:
  - Read of wiki/INDEX.md or a file under wiki/knowledge/  -> refresh this actor's
    marker, allow.
  - Write/Edit/NotebookEdit INSIDE the project -> require fresh marker.
    (Writes outside the project — plan files, /tmp — pass through.)
  - Bash -> require fresh marker, unless the command is a safe read-only invocation.
  - Task/Agent -> require fresh marker.
PostToolUse:
  - Write/Edit/NotebookEdit under wiki/knowledge/ (or wiki/INDEX.md) -> refresh (the
    actor just changed the knowledge, so it is in sync with its own change).

Marker = .claude/state/knowledge-read/<session_id>__<agent_id|main>, content is a unix
timestamp. "Fresh" = at least the newest mtime under wiki/knowledge/ — so when the
knowledge changes, every actor re-reads before continuing. Backlog/card edits never
invalidate the marker (they are work items, not knowledge).

Ops note: replace this script by WRITING OVER it, never delete-then-recreate — the
harness caches hook config per session, and a missing script hard-blocks every tool.
"""
import json
import os
import shlex
import subprocess
import sys
import time

WRITE_TOOLS = {"Write", "Edit", "NotebookEdit"}
SPAWN_TOOLS = {"Task", "Agent"}

READ_ONLY_BINS = {"ls", "pwd", "cat", "head", "tail", "grep", "find", "rg", "wc", "echo"}
READ_ONLY_GIT_SUBCOMMANDS = {"status", "log", "diff", "show", "branch", "rev-parse"}
UNSAFE_SHELL_FEATURES = (
    "&&", "||", "|", ";", "\n", "$(", "`", ">", "<", "&", "*", "?", "~",
)


def project_dir(data):
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


def tool_target(tool_name, tool_input):
    if tool_name == "NotebookEdit":
        return tool_input.get("notebook_path")
    if tool_name in ("Read", "Write", "Edit"):
        return tool_input.get("file_path")
    return None


def is_under(path, root):
    try:
        path = os.path.realpath(path)
        root = os.path.realpath(root)
        return os.path.commonpath([path, root]) == root
    except (ValueError, OSError):
        return False


def newest_mtime(root):
    newest = 0.0
    for base, _dirs, files in os.walk(root):
        for name in files:
            try:
                m = os.path.getmtime(os.path.join(base, name))
                if m > newest:
                    newest = m
            except OSError:
                pass
    return newest


def marker_path(proj, data):
    actor = data.get("agent_id") or "main"
    session = data.get("session_id") or "nosession"
    state = os.path.join(proj, ".claude", "state", "knowledge-read")
    return os.path.join(state, f"{session}__{actor}")


def refresh_marker(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(str(time.time()))


def marker_status(path, know_dir):
    if not os.path.exists(path):
        return "missing"
    try:
        with open(path) as fh:
            marked = float(fh.read().strip())
    except (OSError, ValueError):
        return "missing"
    if marked >= newest_mtime(know_dir):
        return "fresh"
    return "stale"


def is_safe_bash(command):
    if not isinstance(command, str) or not command.strip():
        return False
    if any(f in command for f in UNSAFE_SHELL_FEATURES):
        return False
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return False
    i = 0
    while i < len(tokens) and "=" in tokens[i] and not tokens[i].startswith("="):
        i += 1
    if i >= len(tokens):
        return False
    bin_ = os.path.basename(tokens[i])
    if bin_ in READ_ONLY_BINS:
        return True
    if bin_ == "git" and i + 1 < len(tokens) and tokens[i + 1] in READ_ONLY_GIT_SUBCOMMANDS:
        return True
    return False


NEVER_READ_MSG = (
    "BLOCKED by the Vibin knowledge gate: read wiki/knowledge/index.md and the atoms "
    "relevant to your task first — the knowledge graph is the source of truth. "
    "(Reading a backlog card is not retrieval; read the knowledge.) Then retry.\n"
)

STALE_MSG = (
    "BLOCKED by the Vibin knowledge gate: the knowledge graph changed since you last "
    "read it. Re-read wiki/knowledge/index.md and the atoms relevant to your work, "
    "then retry.\n"
)


def block(reason):
    sys.stderr.write(reason)
    sys.exit(2)


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    proj = project_dir(data)
    know_dir = os.path.join(proj, "wiki", "knowledge")
    if not os.path.isdir(know_dir):
        sys.exit(0)  # no knowledge graph -> nothing to enforce

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    event = data.get("hook_event_name", "PreToolUse")
    marker = marker_path(proj, data)
    target = tool_target(tool_name, tool_input)
    target_abs = None
    if target:
        target_abs = target if os.path.isabs(target) else os.path.join(proj, target)
    index_md = os.path.join(proj, "wiki", "INDEX.md")
    target_is_knowledge = bool(target_abs) and (
        is_under(target_abs, know_dir)
        or os.path.realpath(target_abs) == os.path.realpath(index_md)
        or any(is_under(target_abs, wk) for wk in worktree_knowledge_dirs(proj))
    )
    target_in_project = bool(target_abs) and is_under(target_abs, proj)

    if event == "PostToolUse":
        if tool_name in WRITE_TOOLS and target_is_knowledge:
            refresh_marker(marker)
        sys.exit(0)

    # PreToolUse
    if tool_name == "Read":
        if target_is_knowledge:
            refresh_marker(marker)
        sys.exit(0)

    if tool_name in WRITE_TOOLS:
        if not target_in_project:
            sys.exit(0)
        status = marker_status(marker, know_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    if tool_name == "Bash":
        if is_safe_bash(tool_input.get("command", "")):
            sys.exit(0)
        status = marker_status(marker, know_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    if tool_name in SPAWN_TOOLS:
        status = marker_status(marker, know_dir)
        if status == "fresh":
            sys.exit(0)
        block(STALE_MSG if status == "stale" else NEVER_READ_MSG)

    sys.exit(0)


if __name__ == "__main__":
    main()
