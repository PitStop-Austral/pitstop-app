---
name: start-stack
description: Start and verify the repository's complete local development stack. Prefer the cached root STACK_STARTUP.md fast path; discover the stack only when no usable cached recipe exists or it fails.
disable-model-invocation: true
effort: low
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/fast_path.py *)
---

# Start Stack

## Cached fast path

The bundled script executes a v2 `STACK_STARTUP.md` recipe deterministically: it reuses healthy services, starts only missing ones, verifies them, and prints one terse status line.

Result:
!`${CLAUDE_SKILL_DIR}/scripts/fast_path.py "${CLAUDE_PROJECT_DIR}"`

Interpret the result exactly:

- `FAST_PATH_OK ...` → task succeeded. **Stop immediately.** Do not read `STACK_STARTUP.md`, inspect the repository, read logs, or call tools. Reply in one short sentence with the reported URL(s) and whether services were started/reused.
- `FAST_PATH_MISS reason=no_manifest` → read [references/discovery.md](references/discovery.md), then discover/start/verify and write a v2 manifest.
- `FAST_PATH_MISS reason=legacy_manifest` → read [references/discovery.md](references/discovery.md). Prefer the existing human recipe before broad discovery; after successful verification, upgrade it to v2.
- `FAST_PATH_FAIL ...` → read [references/recovery.md](references/recovery.md). Inspect only the named failed service/log first. Rediscover broadly only if evidence shows the cached recipe is structurally stale.
- If shell injection is disabled and the result above is a placeholder rather than a status, run `${CLAUDE_SKILL_DIR}/scripts/fast_path.py "${CLAUDE_PROJECT_DIR}"` once with Bash and apply the same rules.

Never perform destructive recovery (database/schema resets, volume deletion, unrelated process kills, `sudo`, broad upgrades, or overwriting secrets/env files) without explicit user authorization.
