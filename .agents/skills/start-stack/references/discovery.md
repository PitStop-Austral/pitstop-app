# Discovery and v2 manifest creation

Load this only when the fast path is missing/legacy or recovery establishes that the cached recipe is stale.

## Goal

Start and verify the complete normal local development stack for the repository, then write `<repo-root>/STACK_STARTUP.md` with a machine-readable v2 recipe so future `/start-stack` runs need no repository analysis.

## If a legacy `STACK_STARTUP.md` exists

Read it first. Try its documented commands/checks before broad discovery. If it works, preserve useful human documentation and add the v2 machine block below. Rediscover only if the legacy recipe fails structurally.

## Discovery order

Be economical. Do not recursively read the repository or generated/vendor trees.

1. Resolve the actual repository root (`git rev-parse --show-toplevel` when available).
2. Look first for a single root startup/orchestration mechanism: current README/dev docs, root scripts, Docker Compose, workspace orchestrators (Turbo/Nx/etc.), Make/Just/Task, devcontainers.
3. Only if necessary, identify individual runnable components from configuration: web UI, API, gateway, worker, DB, Redis/cache, broker, emulator, reverse proxy, etc. Folder names are not evidence of role.
4. Use metadata/configuration before source code: `package.json`, lockfiles/workspaces, compose files, `pyproject.toml`, `requirements*`, `pom.xml`, Gradle, `.sln/.csproj`, `go.mod`, `Cargo.toml`, `Gemfile`, env templates, framework configs.
5. Prefer repository-defined commands over inferred framework defaults. Respect the established package manager and existing orchestration. Do not start individual services twice when a higher-level command already starts them.
6. Determine only the startup dependency order that matters.

Ignore/deprioritize `.git`, `node_modules`, `.next`, `dist`, `build`, `coverage`, virtualenvs, `vendor`, caches, and generated output.

## Environment and safety

- Never invent credentials or print/store secret values. Record variable names/sources only.
- Never overwrite an existing env file. A missing local env may be copied from an explicit repo template only when that is clearly the expected safe setup.
- Normal dependency installation is allowed using the repo's established manager. Do not globally upgrade/install runtimes or perform broad upgrades.
- No DB/schema reset/drop, destructive migration, Docker volume deletion, `down -v`, `sudo`, unrelated process kills, or source rewrites merely to make startup easier without explicit authorization.

## Starting and verification

- Reuse already healthy services; do not spawn duplicates.
- Start infrastructure before dependents.
- Run long-lived terminal services detached/backgrounded with inspectable logs.
- Verify with inexpensive, non-destructive checks. Prefer health/readiness endpoints; otherwise safe HTTP/TCP/listener checks plus readiness logs. Frontend and critical backend must be reachable when applicable. Workers must remain alive without fatal dependency loops.
- After initial readiness, make a final liveness check so an immediate crash is not mistaken for success.
- Write/update the manifest only after the required stack actually works.

## Required v2 machine block

Place this near the top of `STACK_STARTUP.md`. It is parsed by the bundled fast-path script and is not shown to Claude on successful future runs.

```markdown
<!-- START_STACK_V2
{
  "version": 2,
  "steps": [
    {
      "name": "infrastructure",
      "cwd": ".",
      "mode": "oneshot",
      "start": "docker compose up -d postgres redis",
      "verify": ["<safe command returning exit 0 only when this step is healthy>"],
      "timeout": 45
    },
    {
      "name": "api",
      "cwd": "apps/api",
      "mode": "background",
      "start": "pnpm dev",
      "verify": ["curl -fsS http://127.0.0.1:3001/health >/dev/null"],
      "timeout": 45
    },
    {
      "name": "web",
      "cwd": "apps/web",
      "mode": "background",
      "start": "pnpm dev",
      "verify": ["curl -fsS http://127.0.0.1:3000 >/dev/null"],
      "timeout": 45
    }
  ],
  "urls": ["http://localhost:3000"]
}
-->
```

Adapt it to the repository. Rules:

- `steps` are already in startup order.
- `cwd` is repository-relative and must stay inside the repo.
- `mode: "oneshot"` means the start command should return (for example `docker compose up -d`).
- `mode: "background"` means the helper detaches the long-running command and stores logs/PIDs outside the repo under `~/.cache/start-stack/`.
- Every step needs at least one deterministic `verify` shell command. Multiple entries must all exit 0.
- A step should represent the highest-level useful unit. If one root command launches the whole stack, prefer one step with verification commands for all critical endpoints rather than duplicating per-service starts.
- Commands must be non-destructive. The helper rejects several destructive patterns.
- `urls` contains only useful user-facing local URLs for the terse success response.

## Human-readable portion

After the machine block, keep only durable information a developer needs manually: prerequisites, startup command/order, URLs, env variable names/sources, normal non-destructive stop commands, and repository-specific troubleshooting. Do not duplicate verbose discovery notes or transient logs.

## Final response

On success: report that the stack is running, primary URL(s), and that `STACK_STARTUP.md` was created/upgraded/updated. Keep it short.

On failure: report running components, blocked component, first actionable cause, smallest required user action, and whether the manifest was left unchanged.
