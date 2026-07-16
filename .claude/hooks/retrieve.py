#!/usr/bin/env python3
"""Vibin v2 retrieval suggester (the "trigger" mechanism).

When an actor reads a work-item card (wiki/backlog/*.md), match the card's words
against the knowledge atoms' tags + titles and surface the most relevant atoms as
additional context — so the right knowledge is one Read away at the moment work
starts. Non-blocking; the knowledge gate (wiki-gate.py) does the enforcing.

PostToolUse (Read): card under wiki/backlog/ -> emit "relevant atoms" context.
"""
import json
import os
import re
import sys

STOPWORDS = {
    "the", "and", "for", "with", "via", "from", "are", "all", "each", "its",
    "their", "into", "not", "but", "this", "that", "have", "has", "they",
}


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def is_under(path, root):
    try:
        path = os.path.realpath(path)
        root = os.path.realpath(root)
        return os.path.commonpath([path, root]) == root
    except (ValueError, OSError):
        return False


def words(text):
    return {w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in STOPWORDS}


def parse_frontmatter(text):
    """Return (title, tags) from a simple YAML frontmatter block."""
    title, tags = "", []
    if text.startswith("---"):
        end = text.find("---", 3)
        if end != -1:
            for line in text[3:end].splitlines():
                line = line.strip()
                if line.startswith("title:"):
                    title = line[6:].strip().strip("\"'")
                elif line.startswith("tags:"):
                    tags = re.findall(r"[a-z0-9-]+", line[5:].lower())
    return title, tags


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    if data.get("tool_name") != "Read":
        sys.exit(0)
    target = (data.get("tool_input", {}) or {}).get("file_path")
    if not target:
        sys.exit(0)

    proj = project_dir(data)
    target_abs = target if os.path.isabs(target) else os.path.join(proj, target)
    backlog = os.path.join(proj, "wiki", "backlog")
    know = os.path.join(proj, "wiki", "knowledge")
    if not is_under(target_abs, backlog) or not target_abs.endswith(".md"):
        sys.exit(0)
    if not os.path.isdir(know):
        sys.exit(0)

    try:
        with open(target_abs) as fh:
            card_words = words(fh.read())
    except OSError:
        sys.exit(0)

    scored = []
    for base, _dirs, files in os.walk(know):
        for name in files:
            if not name.endswith(".md") or name == "index.md":
                continue
            path = os.path.join(base, name)
            try:
                with open(path) as fh:
                    text = fh.read()
            except OSError:
                continue
            title, tags = parse_frontmatter(text)
            stem_words = words(name.replace("-", " ")) | words(title)
            tag_hits = sum(1 for t in tags if t in card_words)
            title_hits = sum(1 for w in stem_words if w in card_words)
            score = 2 * tag_hits + title_hits
            if score > 0:
                rel = os.path.relpath(path, proj)
                scored.append((score, rel, title or name))

    if not scored:
        sys.exit(0)
    scored.sort(key=lambda s: (-s[0], s[1]))
    top = scored[:5]
    lines = "\n".join(f"- {rel} ({title})" for _score, rel, title in top)
    msg = (
        "Relevant knowledge for this work item — read these atoms before working "
        "(the knowledge gate requires it):\n" + lines
    )
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": msg,
        }
    }))
    sys.exit(0)


if __name__ == "__main__":
    main()
