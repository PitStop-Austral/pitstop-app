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
