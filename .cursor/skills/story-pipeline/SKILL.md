---
name: story-pipeline
description: Runs the LiveMemory story factory — WIP=2 stacked GitHub PRs, one cloud agent per story, merge when CI is green, rebase the follower. Use when the user asks to run the story pipeline, continue stories, factory A, stack the next story, or auto-build the backlog.
---

# Story pipeline (mode A)

You are the **orchestrator**. Cloud workers implement one story each. Pierre is the fuse: stop and ask on architecture conflicts, scope fights, or a merge that would skip a failing required check.

Chat in the user's language. All code, commits, PR titles/bodies, and BMAD artifacts stay **English**.

## Invariants

- **WIP = 2.** At most one story `in-progress` (building) and one `review` (PR open / CI / comments). Never a third worker.
- **Stack, do not fork from stale `main`.** Story N+1's cloud `cloud_base_branch` is the **remote branch of story N**, not `main`, while N is unmerged. After N merges, rebase N+1 onto `origin/main` and retarget its PR to `main`.
- **You own `_bmad-output/implementation-artifacts/sprint-status.yaml`.** Workers must not edit it.
- **Never merge `main` with `--no-verify`, never force-push `main`/`master`.** Force-with-lease is allowed only on `story/*` or `cursor/*` after a rebase the user already authorized by this skill.
- **Do not skip GitHub required checks.** Merge only when the PR is mergeable, required CI is green, and review comments are triaged (fix or reply).

## Source of truth

1. `git fetch origin`
2. `_bmad-output/implementation-artifacts/sprint-status.yaml`
3. `_bmad-output/planning-artifacts/epics.md` (story titles + ACs)
4. GitHub: `gh pr list` / `gh pr view` (on this Windows machine, `gh` is `C:\Program Files\GitHub CLI\gh.exe` if it is not on PATH)

Reconcile tracker vs GitHub before acting. Merged PR for a story → `done`. Open PR → `review`. Cloud agent running, no PR yet → `in-progress`.

## Tick (repeat until blocked, epic done, or Pierre stops)

1. **Babysit** every open story PR: conflicts, CI, Bot/Bugbot comments. Push scoped fixes or ask a cloud `/babysit` worker. See [worker-prompt.md](worker-prompt.md).
2. **Merge** a `review` PR when ready (`gh pr merge <n> --squash --auto` is fine once checks are green; if auto-merge is not enabled, merge when mergeable). Then `git fetch origin` and mark the story `done` in sprint-status (`uv run` `bmad-sprint-planning` `sprint_plan.py generate` with `--set key=done`).
3. **Rebase the follower** if a stacked PR still targets the merged branch: rebase onto `origin/main`, `--force-with-lease` that feature branch, `gh pr edit --base main`.
4. **Fill WIP.** If in-flight count `< 2`, start the next `backlog` story in epic order:
   - Base = latest in-flight story branch if one exists, else `origin/main`
   - Launch a **cloud** subagent (`Task`, `environment: cloud`, `cloud_base_branch: <base>`, `run_in_background: true`, `subagent_type: generalPurpose`)
   - Prompt = [worker-prompt.md](worker-prompt.md) with placeholders filled from `epics.md`
   - `--set` that story to `in-progress`
5. **Do not wait forever in one turn.** After launching or merging, report state (PRs, WIP slots, next story) and continue on completion notifications.

## Starting a worker

Fill [worker-prompt.md](worker-prompt.md):

| Placeholder | Value |
| --- | --- |
| `{story_id}` | e.g. `1.6` |
| `{story_key}` | sprint-status key, e.g. `1-6-log-a-one-performer-show-from-add` |
| `{story_title}` | From epics |
| `{base_branch}` | `main` or the predecessor's remote branch |
| `{branch_name}` | `story/{story_key}` |
| `{acceptance_criteria}` | Verbatim AC from `epics.md` |
| `{predecessor_note}` | What is already on the base (merged stories / stacked parent) |

Do not pass local uncommitted files. Cloud clones the remote.

## Stop conditions (ask Pierre)

- Required CI red for a reason outside the story
- Two workers would edit the same migration / domain file in incompatible ways beyond a rebase
- Story AC contradicts SPEC / architecture
- `gh` auth missing or Cloud agent cannot start

## Out of scope

- Starting more than two stories
- Implementing the story yourself in the orchestrator session (delegate)
- Editing product code "to help" the worker unless babysitting that PR
- Cursor Automations (mode B) unless Pierre asks
