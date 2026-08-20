# Documentation review instructions

Review staged changes only to determine whether durable project documentation under `docs/` is now stale.

Minimize reads and tokens.

Start with only:
1. `git diff --cached --unified=2`
2. `docs/README.md` if it exists
3. `docs/DOCUMENTATION_RULES.md` if it exists

Do not scan the repository broadly.

Documentation is generally warranted when staged changes materially affect:
- user-visible features or workflows
- APIs or routes that are part of project behavior
- system architecture or service boundaries
- authentication/authorization behavior
- database schema or durable data model semantics
- environment/configuration requirements
- external integrations
- deployment or local-development behavior
- queues, workers, background jobs, or cross-service flows
- important operational constraints future developers/agents need to know

Documentation is generally NOT warranted for:
- formatting only
- comments only
- tests only
- snapshots only
- generated files only
- lockfile-only changes
- typo fixes
- refactors with unchanged behavior/architecture
- small visual polish that does not alter a documented UX flow
- internal implementation details that do not change the conceptual system

If docs are not stale, return exactly `DOCS_NOT_NEEDED`.

If docs are stale:
1. Identify the smallest relevant documentation set.
2. Read only those files/sections.
3. Read affected source files only if the staged diff is insufficient to resolve ambiguity.
4. Update docs to describe the current system state concisely.
5. Prefer editing existing docs over creating redundant files.
6. If creating docs for the first time, create only the minimum useful structure and include `docs/README.md` as its index.
7. Return only `DOCS_UPDATED: <comma-separated repo-relative paths>`.

Do not stage or commit.
