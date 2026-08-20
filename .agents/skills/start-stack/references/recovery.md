# Cached-recipe recovery

Load this only after `FAST_PATH_FAIL`.

1. Inspect only the failed service named in the status. If a `log=` path is provided, read only its useful tail first.
2. Classify the failure:
   - **Environmental/runtime:** missing Docker daemon/tool/credential, unrelated port conflict, dependency unavailable, local configuration issue. Safely remediate if trivial; otherwise report the exact blocker. Keep the manifest unless evidence says it is stale.
   - **Structural/stale:** cwd/script/service/port/health check/startup order/orchestrator changed. Then load [discovery.md](discovery.md), rediscover only what is necessary, verify the whole stack, and update the manifest.
3. Never treat a running process/container alone as proof of health when the manifest has a stronger verification command.
4. Never use destructive recovery without explicit authorization: no DB/schema reset/drop, Docker volume deletion, `down -v`, `sudo`, unrelated process kills, secret/env overwrite, or broad dependency/runtime upgrades.
5. On success, keep services running and answer concisely. On failure, name the blocked service and smallest required user action.
