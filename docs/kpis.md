# HTTP request logs

The API records one `HttpRequestLog` row for every observed HTTP request. This data is evidence for
future KPI work; PitStop does not yet expose, aggregate, filter, or delete these records.

## Stored fields

| Field                  | Meaning                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method`               | Observed HTTP method.                                                                                                                             |
| `route`                | Resolved Express route template, or `null` when no safe route is resolved.                                                                        |
| `startedAt`, `endedAt` | UTC timestamps at middleware entry and response completion or interruption.                                                                       |
| `durationMs`           | Non-negative elapsed milliseconds measured with a monotonic clock. It ends before telemetry persistence starts.                                   |
| `statusCode`           | Final HTTP status for completed responses; `null` for interrupted ones.                                                                           |
| `outcome`              | `COMPLETED` after `finish`, or `ABORTED` after `close` without a preceding finish.                                                                |
| `trafficKind`          | `HEALTH` for `/health` routes, `UNMATCHED` without a safe route, otherwise `APPLICATION`. `REPORTING` is reserved for future reporting endpoints. |

The log deliberately excludes raw URLs, query strings, route parameters, request bodies, IP addresses,
cookies, and authorization headers.

## Runtime behavior and limits

The middleware installs its listeners before the request reaches Nest handlers. A shared finalizer
prevents a `finish` followed by `close` from writing twice. A failed database insert is logged without
changing the already-produced HTTP response.

On Vercel, `@vercel/functions` registers the persistence lifecycle with `waitUntil`, so the write can
continue after the response is sent. It still shares the function timeout: database outages, instance
termination, or timeout expiry can lose a record. There is intentionally no retry queue, in-memory
buffer, disk spool, or retention policy yet.
