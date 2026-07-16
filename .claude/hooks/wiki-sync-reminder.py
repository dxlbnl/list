#!/usr/bin/env python3
"""Transitional no-op stub (Vibin v2).

v1 wired this hook on PostToolUse; v2 replaced it with capture.py and no longer
references it in settings.json. The stub exists because a session that migrates
v1 -> v2 keeps the OLD hook config cached until restart — and a missing script
hard-errors on every tool call. Exit 0, do nothing. Safe to delete after the
first session restart on v2.
"""
import sys

sys.exit(0)
