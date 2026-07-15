---
name: orchestrate
description: Run multiple sprints in parallel — partition backlog cards, create git worktrees per sprint, spawn background subagents, merge when done. Use when you want to parallelise independent concerns across concurrent sprints.
---

# Orchestrate — parallel sprints

Partition the backlog into independent sprint streams, set up isolated worktrees, and spawn a
background subagent per sprint. You are a **launcher and merger** — the work happens inside each
subagent, which runs its sprint to completion and exits.

## Step 1 — read + partition

1. Read `wiki/knowledge/index.md` and `wiki/knowledge/project/the-rules.md`.
2. Read all cards in `wiki/backlog/`.
3. Propose a partition: group cards by concern (data vs UI, independent features, etc.). No card
   appears in two sprints. Respect dependency order — if card B depends on card A, they go in the
   same sprint or A's sprint completes first. Name each sprint with a short slug.
4. **Pause. Show the partition and wait for explicit go-ahead before creating anything.**

## Step 2 — setup (one sprint at a time)

Verify `.vibin/sprint/` is in `.gitignore` before proceeding.

For each approved sprint:

```bash
git checkout -b sprint/<slug>
git worktree add .vibin/sprint/<slug> sprint/<slug>
git checkout -
```

Write `wiki/sprint.md` **into the worktree**:

```markdown
# Sprint — current

## Sprint goal
<one-line goal for this sprint>

## Tasks
- [ ] <card-slug-1>
- [ ] <card-slug-2>

**Next:** start with <card-slug-1>

## Run log
- Sprint composed by orchestrator. Cards: <slugs>.
```

Copy the sprint's cards into the worktree's backlog:
```bash
cp wiki/backlog/<slug>.md .vibin/sprint/<sprint-slug>/wiki/backlog/
```

## Step 3 — spawn sprint-runner agents

For each sprint, spawn a background **`sprint-runner`** agent (defined in
`.claude/agents/sprint-runner.md`) with this prompt:

> Worktree root: `<absolute-path>/.vibin/sprint/<slug>`
> Sprint branch: `sprint/<slug>`
> Execute the sprint. Follow your agent definition.

All agents run in background concurrently. Report which are running and their worktree paths.

## Step 4 — monitor + merge

While agents run, check progress:
```bash
cat .vibin/sprint/<slug>/wiki/sprint.md   # run log
git log sprint/<slug> --oneline           # commits
```

When a background subagent reports done, review its report (cards closed, atoms captured,
blockers). Then:

1. **Show the diff**: `git diff main...sprint/<slug>` — summarise what changed.
2. **Pause for user go-ahead** before merging. Present: cards closed, atoms captured, any
   concerns from the diff.
3. **Merge** (on main branch):
   ```bash
   git checkout main
   git merge --no-ff sprint/<slug> -m "sprint(<slug>): merge <goal>"
   ```
   Use `--no-ff` to keep the sprint's commit history visible as a group.
4. **Resolve conflicts** if any: wiki atom conflicts first (semantic duplicates — keep one
   canonical home), then source conflicts. Commit the resolution.
5. **Cleanup**:
   ```bash
   git worktree remove .vibin/sprint/<slug>
   git branch -d sprint/<slug>
   ```

Merge one sprint at a time — fully resolve before starting the next merge.

## Rules

- Sprints that touch overlapping source files are a bad partition — re-partition rather than
  racing to a merge conflict.
- Never `git add -A` — parallel worktrees share the repo.
- If a subagent reports a blocker, surface it to the user; don't silently abandon the sprint.
