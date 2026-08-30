# Deployment

`apps/web` and `apps/api` deploy as two separate Vercel projects pointed at the same repo, each
with its own Root Directory. Both auto-deploy to Production on merge to `main` and get a Preview
deployment per pull request.

- **`apps/web`** — standard Vite build (`pnpm build` → `dist`), Vercel's Vite preset.
- **`apps/api`** — NestJS doesn't run `app.listen()` on Vercel. `apps/api/api/index.ts` is the
  serverless function entry: it builds the Nest app once via `apps/api/src/create-app.ts` (caching
  it across warm invocations) and delegates requests to the Express instance Nest already creates
  internally (`app.getHttpAdapter().getInstance()`) — no extra HTTP-adapter dependency. It imports
  from `../dist/create-app` (the compiled output of `nest build`), not `../src`, because Vercel's
  function bundler doesn't support `emitDecoratorMetadata`, which Nest's DI needs. Vercel Build
  Command: `pnpm db:generate && pnpm build`.
- **CORS** is configured once in `create-app.ts` (shared by both `main.ts` and the Vercel entry) via
  `WEB_ORIGIN` — a single required origin, never `*`. Missing `WEB_ORIGIN` fails app startup instead
  of falling back to an open CORS policy.
- **Database**: production uses [Neon](https://neon.tech) Postgres instead of the local Docker
  container. Neon provides two connection strings, both required in `apps/api`'s Vercel env vars:
  - `DATABASE_URL` — the **pooled** (`-pooler`) string. Used by the running app; required for
    serverless, where each invocation can open its own connection.
  - `DIRECT_URL` — the **direct** (non-pooled) string. Used only by `apps/api/prisma.config.ts` for
    running migrations (`prisma migrate`), which need session-level features PgBouncer doesn't
    support. Locally there's no pooler, so `DIRECT_URL` is left empty and falls back to
    `DATABASE_URL`.
  - Migrations are **not** run automatically on deploy — apply them manually against `DIRECT_URL`
    after merging schema changes.
- **Health checks**: `GET /health` (liveness, no DB) and `GET /health/db` (checks the DB
  connection) are both public routes, unauthenticated.
- Env vars are declared per app in `apps/api/.env.example` and `apps/web/.env.example`; set them in
  Vercel for both the Production and Preview environments.
