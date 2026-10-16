# KPI persistence

KPI runs and their results are stored in two tables shared by every indicator, whatever its source.
The API calculates and preserves the six business and HTTP indicators described below. Catalog and
external publication remain separate concerns.

## External health monitor

GitHub Actions runs `.github/workflows/kpi-health-monitor.yml` at minutes 00 and 30 of every hour
(`*/30 * * * *`, UTC). It can also be started manually with `workflow_dispatch` after the workflow
exists on the default branch. The workflow reads the deployed API origin from the repository
variable `API_BASE_URL`; the value should not end with a health-check path.

The monitor executes `GET /health` followed by `GET /health/db`. Each request has a 15-second
timeout and is attempted once, even when the other request fails. The first endpoint succeeds only
with HTTP 200 and `{ "status": "ok" }`; the second succeeds only with HTTP 200 and
`{ "database": "up" }`. The database check observes whether the PitStop API can run its existing
`SELECT 1`; it is not an independent connection from GitHub Actions to Neon.

Run the same monitor locally from the repository root:

```bash
API_BASE_URL=http://localhost:3001 node scripts/kpis/health-checks.mjs
pnpm test:kpi-health
```

Local runs use `runId: "local"` and `runAttempt: 1`. GitHub runs use their actual run ID and attempt.
Every execution writes `health-checks.json` with exactly two ordered checks:

```json
{
  "schemaVersion": 1,
  "runId": "123456789",
  "runAttempt": 1,
  "checks": [
    {
      "target": "api",
      "checkedAt": "2026-10-15T12:00:00.000Z",
      "httpStatus": 200,
      "ok": true,
      "errorKind": null
    },
    {
      "target": "db",
      "checkedAt": "2026-10-15T12:00:01.000Z",
      "httpStatus": 503,
      "ok": false,
      "errorKind": "http_error"
    }
  ]
}
```

`httpStatus` is null when no HTTP response exists. `errorKind` is `http_error`, `timeout`,
`connection_error`, `invalid_response`, or null. The artifact deliberately excludes response
bodies, headers, transport messages, and credentials.

GitHub uploads the file as `kpi-health-<runId>-<runAttempt>` even when a check fails, retains it for
14 days, and only then marks an unhealthy run as failed. Download it from the workflow run's
Artifacts section. A force-cancelled run, runner failure, or failure before the script executes may
prevent artifact creation. Scheduled workflows can also be delayed or skipped by GitHub; an absent
run is not represented by a fabricated sample.

## Daily publication to Supabase

`.github/workflows/kpi-daily.yml` sends each closed Argentine day's KPI batch to the shared Supabase
receiver and reads it back. It runs at `0 4 * * *` UTC (01:00 in Argentina) and can be started
manually. Scripts live in `scripts/kpis/`, use only Node 24 built-ins, and have no package of their
own. Run `pnpm test:kpis` for the pipeline tests (CI runs them in the `Test KPI scripts` step).

### Configuration

The `context` job resolves the env before any GitHub Environment is selected: the manual
`environment` input, or the repository variable `KPI_SCHEDULE_ENV` for schedules, or `dev`. Any
other value fails the run. The `publish` job then selects the `dev` or `prod` GitHub Environment,
which must define:

| Name                       | Kind     | Purpose                                                                  |
| -------------------------- | -------- | ------------------------------------------------------------------------ |
| `API_BASE_URL`             | variable | PitStop API origin of that deployment (same name the other jobs use).    |
| `CRON_SECRET`              | secret   | Service credential for `GET /internal/kpis/daily`.                       |
| `KPI_API_BASE_URL`         | variable | Supabase receiver origin, e.g. `https://<ref>.supabase.co`.              |
| `SUPABASE_PUBLISHABLE_KEY` | secret   | Receiver `apikey` header.                                                |
| `PROJECT_KEY`              | secret   | Receiver `X-Project-Key`; bound to team and env, so dev and prod differ. |
| `KPI_ENABLE_AVAILABILITY`  | variable | `true` once PIT-72's collector exists; otherwise the source is skipped.  |
| `KPI_ENABLE_DELIVERY`      | variable | `true` once PIT-74's collector exists; otherwise the source is skipped.  |

Credentials travel only through step env, never as arguments or JSON. A prod key is never used as a
dev fallback. The first real publication must happen in dev; prod is selectable but not exercised by
this work.

### Collect mode

1. `api-snapshot.mjs` calls `GET /internal/kpis/daily?date=<day>&env=<env>` with
   `Authorization: Bearer <CRON_SECRET>` (60 s timeout) and writes `api.json`. It tells two kinds of
   failure apart, and both fail the step. There is no fallback to mocks or zeros.
   - **Source failure**: a non-2xx status (401, 404, 503…), timeout, connection error, or a body
     that is not JSON, plus missing `API_BASE_URL`/`CRON_SECRET`. It writes `error: { code }`; the
     READY values of the other sources are still published and the run fails.
   - **Contract violation**: a parseable response with a date or env other than the requested
     ones, missing `runId`/`calculationVersion`, a foreign or duplicate KPI id, a non-finite or
     null value, an out-of-range value, or an invalid window. It writes `invalid: { code }`, which
     blocks the whole batch: nothing is posted for any source.
2. The enabled availability/delivery collectors write their own fragments.
3. Every fragment is uploaded as `kpi-sources-<env>-<date>-<run>-<attempt>`.
4. `prepare-batch.mjs` validates all fragments, assigns one publication UUID, and writes
   `payload.json` (the exact POST body) and `manifest.json` (SHA-256 of the payload, sources,
   calculation versions, source references, diagnostics). A fragment that breaks the contract, or
   is marked `invalid`, stops the run before anything is posted. A missing or failed enabled source is recorded as `ERROR`;
   the READY values of the other sources are still published and the run still fails.
5. Without READY values there is no POST; the manifest is uploaded as `kpi-manifest-…`.
6. The `publish-kpis` composite action publishes the batch (below).

### Composite action `publish-kpis`

`.github/actions/publish-kpis/action.yml` never computes anything. It:

1. Validates the batch against the expected date/env and the manifest's payload hash.
2. Uploads the batch directory as `kpi-batch-<env>-<date>-<run>-<attempt>` (14 days). The POST
   refuses to run without that upload's artifact id.
3. POSTs `payload.json` byte for byte to
   `/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env` with
   `Prefer: resolution=ignore-duplicates`. Timeouts, connection errors, 429, and 5xx are retried up to
   three attempts in total (waits of 5 s and 15 s, or a valid `Retry-After`), within a 2-minute
   budget (`KPI_PUBLISH_BUDGET_MS`, optional; empty means 120000, anything other than a positive
   integer fails the step before any POST). 400, 401, 403, and 409 are never retried. After a timeout
   or lost connection the rows may already be stored, so a later 4xx is reported as `ambiguous`,
   not `rejected`.
4. Reads the rows back with `GET /rest/v1/measurement?select=…&date=eq.…&env=eq.…&kpi_id=in.(…)`,
   after anything except a clean `rejected` refusal (including `ambiguous` and `unavailable`), and
   classifies each KPI as `verified`, `already_present` (same
   value from another batch), `conflict` (different value; never overwritten), `missing`, or
   `duplicate`. Only the first two pass. The read contract is assumed to be PostgREST;
   `buildVerifyRequest` in `verify-batch.mjs` is the only place to change if the receiver differs.
5. Uploads `receipt.json` as `kpi-receipt-…`: publication UUID, Actions run, backup artifact id,
   POST attempts (status codes only), whether a read-back was required, per-KPI verification, and the
   source run when recovered. If `payload.json` or the receipt is damaged when verification runs, a
   receipt is still written with a safe code (`PAYLOAD_INVALID_JSON`, `RECEIPT_INVALID_JSON`,
   `RECEIPT_MISSING`, …) and the step fails.

The API snapshot `runId`, the Actions run ID, and the publication UUID are three different
identifiers. Re-running a failed collect job computes a new batch with a new UUID; use recovery to
re-send the original one.

### Recovering a failed publication

1. Open the failed run and copy its run ID (from the URL) and the `kpi-batch-…` artifact name.
2. Run **KPI daily publication** manually with `mode=recover`, the same `environment`, the batch's
   `date`, `source_run_id`, and `artifact_name`.
3. The run checks that the source run belongs to this repository and to `kpi-daily.yml`, finds that
   exact artifact (it never picks the latest one), downloads it, re-validates its hash, date, env,
   and UUID, and passes it to the same composite action. No API, collector, or `prepare-batch` step
   runs, so changed data or flags cannot alter the batch.
4. The new run uploads its own `kpi-batch-…` copy before posting and a receipt that names the source
   run.

An expired artifact (after 14 days) cannot be recovered and is never rebuilt by recalculating.
Runs share the concurrency group `kpi-daily-<env>` with `cancel-in-progress: false`: a running
publication is never cancelled, but GitHub keeps only one pending run per group, so a newer queued
run can cancel an older pending one.

### Contract for other sources

Collectors use the same CLI shape and write one fragment each:

```bash
node scripts/kpis/api-snapshot.mjs --date 2026-10-21 --env dev --output .tmp/kpis/fragments/api.json
node scripts/kpis/availability.mjs --date 2026-10-21 --env dev --output .tmp/kpis/fragments/availability.json
node scripts/kpis/delivery.mjs --date 2026-10-21 --env dev --output .tmp/kpis/fragments/delivery.json
```

The last two are integration points for PIT-72 and PIT-74. Valid examples for each source are in
`scripts/kpis/tests/fixtures/` and `validateFragment` in `contracts.mjs` is the authoritative check:

- `schemaVersion: 1`, `source` (`api` | `availability` | `delivery`), `date`, and `env` equal to the
  run context; optional `calculationVersion` (string) and `sourceRef` (object).
- `measurements`: `{ kpi_id, value }` for READY KPIs only, finite and within range. Allowed ids:
  `api` → `preventive_rate`, `alert_resolution_rate`, `service_users_30d`, `active_vehicles_30d`,
  `api_error_rate`, `api_latency_p95`; `availability` → `api_availability`, `db_availability`;
  `delivery` → `ci_success_rate` (%), `mean_time_to_merge` (hours, fractions kept).
- Percentages are 0–100, counts non-negative integers, milliseconds and hours non-negative.
- `diagnostics`: one entry per KPI with `status` (`READY` | `NO_DATA` | `ERROR`), optional safe `code`
  (`[A-Z0-9_]`), a window, and optional `numerator`/`denominator`/`sampleCount` as non-negative
  integers or decimal strings. `windowEnd` must equal the end of the closed day (`<date+1>T03:00Z`);
  `windowStart` may be earlier (30-day KPIs start 29 days before) but never later than
  `<date>T03:00Z`.
- A source that could not be read writes `error: { code }` with empty measurements and exits
  non-zero; the other sources are still published.
- A source that received contract-breaking data writes `invalid: { code }` with empty measurements
  and exits non-zero; the whole batch is blocked.

### Pending verification in dev

These checks need the dev receiver credentials and are not covered by the local tests:

- **Receiver atomicity.** Post a two-row batch to dev where one row is invalid (for example an
  unknown `kpi_id`) and confirm that neither row is stored:

  ```bash
  RUN_ID=$(node -e 'console.log(crypto.randomUUID())')
  curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
    "$KPI_API_BASE_URL/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env" \
    -H 'Content-Type: application/json' -H 'Prefer: resolution=ignore-duplicates' \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "X-Project-Key: $PROJECT_KEY" \
    -d "[{\"kpi_id\":\"preventive_rate\",\"date\":\"2026-01-01\",\"env\":\"dev\",\"value\":50,\"run_id\":\"$RUN_ID\"},
         {\"kpi_id\":\"not_a_kpi\",\"date\":\"2026-01-01\",\"env\":\"dev\",\"value\":1,\"run_id\":\"$RUN_ID\"}]"
  curl -sS "$KPI_API_BASE_URL/rest/v1/measurement?select=kpi_id,value,run_id&date=eq.2026-01-01&env=eq.dev" \
    -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "X-Project-Key: $PROJECT_KEY"
  ```

  Expect a 4xx on the POST and no row with that `run_id` in the GET.

- **Read-back contract.** Confirm the GET above returns the stored rows; if TEAM_GUIDE defines a
  different read endpoint, update `buildVerifyRequest`.
- **Exact values on read-back.** Verification compares values with strict equality and has no
  tolerance, because the receiver's column type is unknown. Post fractional values (for example
  `87.5` and `5.25`) and confirm the GET returns them unchanged; if they come back rounded or
  reformatted, every batch with such values will be reported as `conflict`.
- **Actions run.** After the workflow reaches the default branch, run `mode=collect` in dev (it must
  fail visibly while PIT-69's endpoint is missing) and `mode=recover` against a saved batch. The full
  API → Supabase dev path is verified in PIT-75.

## Data model

- `kpi_runs` (`KpiRun`): one calculation run for an environment (`DEV`/`PROD`) and an Argentine day
  (`date`, `@db.Date`), with its daily window (`windowStart` inclusive, `windowEnd` exclusive),
  `calculationVersion`, internal `status` (`PENDING`/`COMPLETED`/`FAILED`), `startedAt`,
  `finishedAt`, and a safe `errorCode`. Indexed by `(env, date)` without uniqueness, so several
  runs of the same day and environment can coexist. The run UUID is supplied by the caller so a
  retry reuses it.
- `kpi_results` (`KpiResult`): one row per KPI in a run, unique by `(runId, kpiId)` and indexed by
  `kpiId`. `status` is `READY`, `NO_DATA`, or `ERROR`; `value` is double precision; `numerator`,
  `denominator`, and `sampleCount` are `BigInt`; the result has its own window (it may differ from
  the run's, e.g. 30-day KPIs) and a safe `diagnosticCode`. `kpiId` references the future versioned
  catalog logically; there is no catalog table.
- All date-time columns are `timestamptz`. `date` stores the UTC day of the `Date` it receives, so
  callers must build the Argentine day themselves.

Database constraints (CHECKs added by hand to the Prisma migration, since Prisma can't declare them):

- `windowStart < windowEnd` on both tables.
- `READY` requires a finite `value` (no `NaN`/`±Infinity`); `NO_DATA` and `ERROR` require `value`
  null. A measured `0` is valid and is not a substitute for missing data.
- Counts, when present, are non-negative.
- The FK rejects orphan results and restricts deleting a run that still has results.

Diagnostics and error codes must never hold raw messages, credentials, or personal data.

## Daily KPI endpoint

The reporting runner calls:

```http
GET /internal/kpis/daily?date=2026-10-21&env=dev
Authorization: Bearer <CRON_SECRET>
```

`date` must be a real, closed Argentine calendar day in strict `YYYY-MM-DD` format. `env` must be
`dev` or `prod`; it labels the snapshot and does not select a database. The controller is public to
the global Firebase guard but protected by `CronSecretGuard`, so it never synchronizes an end user.
Responses use `Cache-Control: no-store`.

The daily window uses `America/Argentina/Buenos_Aires`, with an inclusive start and exclusive end.
For example, 2026-10-21 is `2026-10-21T03:00:00.000Z` through
`2026-10-22T03:00:00.000Z`. The 30-day window contains that day and the preceding 29 days.

| KPI                     | Source and rule                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `preventive_rate`       | `MANTENIMIENTO` services / all services by service date over 30 days, recorded before the cutoff.                  |
| `alert_resolution_rate` | `NO_DATA` with `ALERT_RESOLUTION_EVIDENCE_MISSING` until PIT-73 adds resolution evidence.                          |
| `service_users_30d`     | Distinct vehicle owners with a maintenance whose `createdAt` is in the 30-day window.                              |
| `active_vehicles_30d`   | Distinct vehicles with a maintenance whose `createdAt` is in the 30-day window.                                    |
| `api_error_rate`        | Completed application requests returning 5xx / all completed application requests for the day.                     |
| `api_latency_p95`       | Nearest-rank p95 duration of the same completed application requests: position `ceil(0.95 × n)`, counted from one. |

Successful empty count queries produce a measured zero. Ratios without a denominator and percentiles
without samples produce `NO_DATA`, never a fabricated zero. `HEALTH`, `REPORTING`, `UNMATCHED`, and
`ABORTED` traffic is excluded from HTTP measurements; the response reports the aggregated aborted count
separately on both HTTP diagnostics.

The response contains all six ordered diagnostics and only `READY` measurements. Evidence counts are
serialized as decimal strings. A successful evaluation is persisted as one `COMPLETED` run with six
results even when some results are `NO_DATA`. A source failure attempts to preserve a `FAILED` run with
safe `ERROR` diagnostics and returns 503; a persistence failure also returns 503 without claiming that a
snapshot was saved.

`KpisModule` (`apps/api/src/modules/kpis/`) keeps Prisma access in `KpisRepository`:

- `createRunWithResults` creates a run and all its results in one nested create, which Prisma runs
  as a single transaction: if any result fails, nothing is persisted.
- `readDailySources` reads the related source data in a `RepeatableRead` transaction.
- `findRunById` returns the run with its results ordered by `kpiId`, or `null`.

A duplicate run UUID or a duplicate `(runId, kpiId)` fails with Prisma `P2002` and never overwrites
existing rows.

## Tests

`apps/api/test/kpis.db-spec.ts` checks the constraints and atomicity against a dedicated database
whose name ends in `_test`. Jest does not load `.env`, so pass `TEST_DATABASE_URL` on the command:

```bash
DATABASE_URL="$TEST_DATABASE_URL" DIRECT_URL="$TEST_DATABASE_URL" pnpm --filter api exec prisma migrate deploy
TEST_DATABASE_URL="$TEST_DATABASE_URL" pnpm --filter api test:e2e:db
```

## HTTP request logs

The API records one `HttpRequestLog` row for every observed HTTP request. The daily KPI endpoint
aggregates the eligible application rows; PitStop does not otherwise expose or delete these records.

### Stored fields

| Field                  | Meaning                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `method`               | Observed HTTP method.                                                                                                             |
| `route`                | Resolved Express route template, or `null` when no safe route is resolved.                                                        |
| `startedAt`, `endedAt` | UTC timestamps at middleware entry and response completion or interruption.                                                       |
| `durationMs`           | Non-negative elapsed milliseconds measured with a monotonic clock. It ends before telemetry persistence starts.                   |
| `statusCode`           | Final HTTP status for completed responses; `null` for interrupted ones.                                                           |
| `outcome`              | `COMPLETED` after `finish`, or `ABORTED` after `close` without a preceding finish.                                                |
| `trafficKind`          | `HEALTH` for `/health` routes, `REPORTING` for `/internal/kpis/daily`, `UNMATCHED` without a safe route, otherwise `APPLICATION`. |

The log deliberately excludes raw URLs, query strings, route parameters, request bodies, IP addresses,
cookies, and authorization headers.

### Runtime behavior and limits

The middleware installs its listeners before the request reaches Nest handlers. A shared finalizer
prevents a `finish` followed by `close` from writing twice. A failed database insert is logged without
changing the already-produced HTTP response.

On Vercel, `@vercel/functions` registers the persistence lifecycle with `waitUntil`, so the write can
continue after the response is sent. It still shares the function timeout: database outages, instance
termination, or timeout expiry can lose a record. There is intentionally no retry queue, in-memory
buffer, disk spool, or retention policy yet.
