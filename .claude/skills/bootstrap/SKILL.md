---
name: bootstrap
description: Primary entry point for a freshly cloned Vibin seed. Interviews the user, seeds the knowledge graph, scaffolds the stack, writes the permission profile, strips seed-meta, and hands off to the loop skill. Use when starting a new project, or when the user says "bootstrap" or "let's begin".
disable-model-invocation: false
---

# Bootstrap — set up a new Vibin v2 project

Turns a fresh clone of the seed into a working project: a seeded knowledge graph, a scaffolded stack,
the right permissions, and a first sprint. Pause for the user's confirmation between phases.

## Phase 1 — interview

Ask, conversationally (batch with `AskUserQuestion` where it fits):
- **What is this project, and why?** (one paragraph in the user's voice)
- **Stack + package manager** (pick a stack key from the table below) and the **code dirs** (where
  product code will live, e.g. `src/`).
- **Binding constraints** — anything all future work must obey (language strictness, runtime targets,
  forbidden deps, test policy).
- **Initial work items** — the first few things to build (a line or a paragraph each).

## Phase 2 — seed the knowledge graph

Create the first atoms under `wiki/knowledge/project/` (format: see `wiki/knowledge/index.md`):
- `what-<project>-is.md` — identity, why, success criteria, non-goals (from the interview).
- `the-rules.md` — the binding constraints, RFC-2119, **including the package manager** ("MUST be X —
  never Y/Z") and the test policy.
- `project-structure.md` — the planned layout + any reserved namespaces.

Link them to each other; list them in `wiki/knowledge/index.md`. **Then pause** — ask the user to
review/refine. The graph is open-ended; they can add or reshape atoms.

## Phase 3 — scaffold

- Create the structure named in `project-structure.md` and the **minimal** test-runner config for the
  chosen stack — just enough that a failing test can run. Nothing more.
- Set the capture gate's code dirs: edit `CODE_DIRS` in `.claude/hooks/capture.py` to the project's
  actual code dirs (from the interview).
- File the initial work items as cards in `wiki/backlog/` per the `intake` skill (slug-named,
  card-is-spec, proportional detail, linked to atoms).

For configuration touching the user's environment, CI, or external services: describe the exact
change and ask the user to apply it — don't run setup scripts yourself.

## Phase 4 — permissions + seed hygiene

**Append the stack permission profile** to `.claude/settings.json` `permissions.allow` (keep the
universal entries):

| Stack key | Entries to append |
|---|---|
| `typescript-pnpm` | `Bash(pnpm:*)`, `Bash(pnpx:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `typescript-npm`  | `Bash(npm:*)`, `Bash(npx:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `typescript-yarn` | `Bash(yarn:*)`, `Bash(node:*)`, `Bash(tsc:*)`, `Bash(tsx:*)` |
| `python-uv`       | `Bash(uv:*)`, `Bash(python:*)`, `Bash(python3:*)`, `Bash(pytest:*)`, `Bash(ruff:*)`, `Bash(mypy:*)` |
| `python-pip`      | `Bash(pip:*)`, `Bash(pip3:*)`, `Bash(python:*)`, `Bash(python3:*)`, `Bash(pytest:*)`, `Bash(ruff:*)` |
| `rust`            | `Bash(cargo:*)`, `Bash(rustc:*)` |
| `go`              | `Bash(go:*)`, `Bash(gofmt:*)` |
| `other`           | Ask the user for the package manager / runtime / test commands and write a custom list. |

> Only the declared package manager gets an allow entry — a wrong-tool `npm install` then hits a
> permission prompt, backing up the rule in `the-rules.md`.

**Strip Vibin seed-meta.** A fresh clone carries Vibin's own development material — none of it belongs
in a project: `git rm -r --quiet .vibin/` and `git rm --quiet README.md` (Vibin's README describes the
seed; the project grows its own). Keep `CLAUDE.md`, `.claude/**`, and `wiki/`.

**Stamp the seed version.** Create `.vibin-version` (root) containing the current head commit hash of
`dxlbnl/vibin` — query the GitHub API (don't rely on local git; clones often wipe `.git`).
`/migrate-vibin` later uses it to upgrade the project.

## Phase 5 — hand off

Do **not** commit — leave the scaffold + seeded wiki as uncommitted changes; the first `loop` run
commits the baseline if the user asks. Tell the user bootstrap is done and start the **`loop`** skill
(first sprint: pull the top cards).
