---
name: sync-project-docs
description: Cheaply determine whether staged changes require project documentation updates, and update only the relevant docs when necessary. Intended to be invoked by another commit-oriented skill before committing.
---

# Sync Project Docs

Synchronize repository documentation with the changes currently staged for commit.

Optimize for minimal token usage.

## Contract

1. Operate on the repository containing the current working directory.
2. Inspect only staged changes (`git diff --cached`) for the primary decision.
3. Run `scripts/docs_gate.py` first.
4. If the script returns `SKIP`, return `DOCS_NOT_NEEDED` immediately. Do not invoke another model or broadly inspect the repository.
5. If the script returns `REVIEW`, perform the smallest possible semantic review.
6. Prefer the cheapest available isolated subagent/model with low reasoning effort. If the host cannot delegate, perform the review in the current agent with the same minimal-read constraints.
7. Read `references/reviewer.md` only for the `REVIEW` path.
8. If documentation does not need changes, return exactly `DOCS_NOT_NEEDED`.
9. If documentation needs changes, modify only the relevant files under the repository-root `docs/` tree, then return:
   `DOCS_UPDATED: <comma-separated repo-relative paths>`
10. Do not stage or commit anything. The calling skill owns staging and committing.
11. The result line is addressed to the calling skill, not to the user, and it never ends the caller's work. When this skill is loaded into an existing turn instead of a separate subagent, report the result and let the caller continue its workflow in the same turn.

## Documentation location

Use `<repo-root>/docs/` as the canonical documentation root.

Do not assume code folders are literally named `frontend` or `backend`. Documentation subfolders should reflect the actual runtime/components of the repository when they already exist.

If `docs/` does not exist and the staged change clearly warrants durable project documentation, create the minimum useful documentation structure rather than documenting the whole repository unnecessarily.

## Safety

- Never write secrets, tokens, passwords, private keys, or credential values into docs.
- Do not change application code.
- Do not rewrite unrelated documentation.
- Do not create changelog-style noise for trivial implementation details.
- Document current behavior/state, not a verbose history of the commit.
