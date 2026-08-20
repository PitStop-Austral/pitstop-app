---
name: commit-local-changes
description: Review the current Git branch's local changes, synchronize project documentation through the installed sync-project-docs skill, and create a concise, well-documented commit in English. Use when the user asks to commit current work or create a commit describing recent local changes.
---

# Commit Local Changes

Review the changes currently present on the active Git branch, understand what was actually implemented, synchronize project documentation when needed, and create one useful Git commit documenting the coherent current work.

## Workflow

1. Check the repository state.
   - Run `git branch --show-current`.
   - Run `git status --short`.
   - Inspect staged and unstaged changes with `git diff` and `git diff --cached`.
   - Inspect relevant untracked files when they are part of the work.
   - Do not switch branches.

2. Understand the changes.
   - Read the actual diff rather than relying only on filenames or the task description.
   - Identify the main purpose and meaningful implementation details.
   - Ignore generated files, build artifacts, dependency caches, and unrelated modifications unless intentionally part of the work.
   - Before staging, check for secrets or sensitive files such as `.env` files, credentials, private keys, tokens, or local configuration containing secrets. Do not commit them.

3. Stage the intended changes.
   - Stage only changes belonging to the coherent current work.
   - Prefer explicit paths when unrelated changes exist.
   - Preserve existing staged changes unless they are clearly unrelated or unsafe. If preserving them would mix unrelated work into the commit, stop and ask the user how to proceed.
   - Do not discard, reset, stash, or overwrite unrelated changes.

4. Synchronize project documentation.
   - Before creating the commit, invoke the separately installed skill named `sync-project-docs` using the current host/agent's native skill invocation mechanism.
   - The invocation is mandatory. Wait for it to finish before continuing.
   - Hosts differ: some run `sync-project-docs` as an isolated subagent, others load its instructions into the current turn. Either way its result line is an internal handoff back to this workflow, never a final answer to the user. When it runs inline, do not end the turn on that result — carry on with the handling below and then step 5 within the same turn.
   - `sync-project-docs` reviews only the staged commit candidate and owns the decision about whether documentation needs updating.
   - Handle its result exactly as follows:
     - `DOCS_NOT_NEEDED` → continue without documentation changes.
     - `DOCS_UPDATED: <paths>` → stage exactly those documentation paths, then inspect `git diff --cached` again so the commit message reflects both code and documentation changes.
     - `DOCS_BLOCKED: <reason>` → do not create the commit. Report the blocker.
   - If the host cannot find or invoke the installed `sync-project-docs` skill, do not silently skip this step. Report that the required skill is unavailable and do not commit.
   - Do not ask `sync-project-docs` to commit, push, reset, stash, or alter unrelated files; this skill remains responsible for Git staging and commit creation.

5. Create the commit.
   - Reaching step 4 is not completion. Unless `DOCS_BLOCKED` stopped the workflow, this step must run before the turn ends.
   - Use a Conventional Commits-style subject: `type(scope): short description`.
   - Choose the type from the actual work: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, or `perf`.
   - Keep the subject concise and in English.
   - Add a compact body with enough context to document what changed.

## Commit Message Format

Use this structure:

```text
<type>(<scope>): <short description>

Summary:
- <meaningful change>
- <meaningful change>

Notes:
- <important implementation detail, behavior change, or relevant context>
```

Use two to four body bullets total. Omit `Notes` when there is nothing meaningful to add.

Example:

```text
feat(auth): add session refresh handling

Summary:
- Added automatic token refresh before session expiration.
- Updated the API client to retry requests after a successful refresh.

Notes:
- Prevents users from being unexpectedly logged out during active sessions.
```

## Rules

- Base the commit message on the actual diff; never guess from the task description alone.
- Keep the commit informative but compact. Avoid generic subjects such as `update code`, `fix stuff`, or `changes`.
- Do not amend an existing commit unless explicitly requested.
- Do not push to a remote.
- Do not run destructive Git commands such as `git reset --hard` or `git clean`.
- If there are no changes, report that clearly and do not create an empty commit.
- Never finish a turn with changes staged but uncommitted. Staging without committing leaves the work half-done.
- If changes contain multiple unrelated pieces of work, commit only the coherent current work and leave unrelated changes untouched.
- Documentation changes produced by `sync-project-docs` belong to the same commit that triggered them.
- After committing, run `git status --short` and report the commit hash and complete commit message.
