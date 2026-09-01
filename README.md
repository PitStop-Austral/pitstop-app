# PitStop MVP

PitStop is a pnpm workspace managed by Turborepo. It contains the MVP web app and API for the
vehicle maintenance platform, plus the shared tooling the team uses locally and in pull requests.

## Stack

- **Workspace:** pnpm 11
- **Task runner:** Turborepo 2
- **API:** NestJS 11
- **Database / ORM:** PostgreSQL 16 via Docker Compose, Prisma ORM 7
- **Web:** React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS 4
- **Linting:** Oxlint
- **Formatting:** Oxfmt
- **Git hooks:** Husky + lint-staged
- **Testing:** Jest (API)

## Repository layout

```text
.
├── apps/
│   ├── api/              # NestJS API (default port 3001, own .env.example)
│   └── web/              # Vite/React app (default port 3000, own .env.example)
├── packages/             # Reserved for shared workspace packages
├── docker-compose.yml    # Local PostgreSQL for development (run via `pnpm db:up`/`db:down`)
├── storage.rules         # Firebase Storage security rules (pasted into the console manually)
├── .oxlintrc.json        # Shared Oxlint configuration
├── .oxfmtrc.json         # Shared Oxfmt configuration
├── pnpm-workspace.yaml   # Workspace package globs
├── turbo.json            # Turborepo task graph and cache settings
└── package.json          # Root scripts and development tooling
```

## Requirements

- A current Node.js release compatible with the repository dependencies
- [pnpm 11](https://pnpm.io/installation) (the repository declares `^11.20.0`)
- Docker Desktop or a compatible Docker engine for the local PostgreSQL database

Install pnpm by following the [official pnpm installation documentation](https://pnpm.io/installation).

## Getting started

1. Clone the repository.
2. Copy each app's environment variable template to its own `.env` (see
   [Environment variables](#environment-variables) for what goes in each one):

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Start PostgreSQL:

```bash
pnpm db:up
```

4. Install dependencies:

```bash
pnpm install
```

5. Generate Prisma Client:

```bash
pnpm db:generate
```

6. Apply the database migrations:

```bash
pnpm db:migrate
```

7. Start the web app and API together:

```bash
pnpm dev
```

The web app runs at `http://localhost:3000` and the API listens on `http://localhost:3001`.

To stop and remove the local database while keeping data:

```bash
pnpm db:down
```

To stop and remove the local database including its volume:

```bash
docker compose --env-file apps/api/.env down -v
```

## Local database

`docker-compose.yml` still uses `${POSTGRES_USER:-pitstop}`-style interpolation for
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and the host port — there is no root `.env` for
Compose to read those from anymore, so `pnpm db:up`/`pnpm db:down` pass `apps/api/.env` explicitly
with `docker compose --env-file apps/api/.env ...`. That resolves the interpolation in the YAML
(and, through the `environment:` block, sets the same values inside the container), so the local
Postgres container and the API always use the same values. `apps/api/.env.example` has a matching
`DATABASE_URL` built from those same default values:

```bash
DATABASE_URL=postgresql://pitstop:pitstop@localhost:5433/pitstop
```

You can connect from the host machine with `psql` or any database client using that URL.
PostgreSQL uses host port `5433` by default to avoid conflicts with an existing local installation;
if you change `POSTGRES_PORT` (or any other `POSTGRES_*` value) in `apps/api/.env`, update
`DATABASE_URL` in the same file to match — the two are not linked automatically. Because the
container uses a named volume, data survives `docker compose restart`.

If you run raw `docker compose` commands instead of the `pnpm db:*` scripts, remember to pass
`--env-file apps/api/.env` yourself, or the interpolation falls back to the `pitstop`/`5433`
defaults baked into `docker-compose.yml`.

## Firebase setup

The app uses a shared Firebase project for Authentication (email/password) and Storage. To get your
own local credentials:

1. Ask a teammate for access to the shared Firebase project (it already exists; you don't need to
   create your own).
2. In the Firebase console, go to Project settings > General > Your apps, find (or add) the Web app,
   and copy its config values into `apps/web/.env` as `VITE_FIREBASE_API_KEY`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`.
3. In the console, go to Project settings > Service accounts > Generate new private key. Open the
   downloaded JSON, copy `project_id`, `client_email`, and `private_key` into `apps/api/.env` as
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`, then delete the
   downloaded JSON file. Never commit it.
4. Confirm the Email/Password provider is enabled under Authentication > Sign-in method (this is a
   one-time, project-level setting, not per-dev).
5. Confirm the Storage bucket exists, then paste the contents of the repository's `storage.rules`
   into its Rules tab and publish (also one-time, project-level).

## Team workflow

- Branch names follow `feat/PIT-XX-description` for feature work unless the ticket calls for a
  different prefix.
- Open a pull request against the default branch when the ticket is ready for review.
- Ask for review from the team members responsible for the affected area and wait for approval
  before merging.

Definition of done for repository-level setup work:

- The local database starts with `pnpm db:up`.
- `pnpm install` completes and installs the Git hooks automatically.
- `pnpm dev` starts both apps on the documented ports.
- `pnpm format:check`, `pnpm lint`, `pnpm check-types`, `pnpm test`, and `pnpm build` pass from
  the repository root.

## Commands

Run these commands from the repository root.

| Command             | Purpose                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `pnpm dev`          | Run all development servers.                                         |
| `pnpm dev:web`      | Run only the web application.                                        |
| `pnpm dev:api`      | Run only the API.                                                    |
| `pnpm test`         | Run workspace tests.                                                 |
| `pnpm build`        | Build all applications in dependency order.                          |
| `pnpm check-types`  | Type-check all workspace packages.                                   |
| `pnpm db:up`        | Start the local PostgreSQL container.                                |
| `pnpm db:down`      | Stop the local PostgreSQL container (keeps its data volume).         |
| `pnpm lint`         | Check the repository with Oxlint.                                    |
| `pnpm lint:fix`     | Apply Oxlint autofixes where available.                              |
| `pnpm format`       | Format files in place with Oxfmt.                                    |
| `pnpm format:check` | Verify formatting without modifying files.                           |
| `pnpm db:generate`  | Generate Prisma Client from the current schema.                      |
| `pnpm db:migrate`   | Apply committed migrations and create migrations for schema changes. |
| `pnpm db:studio`    | Open Prisma Studio for the local database.                           |

API-specific Jest commands:

```bash
pnpm --filter api test
pnpm --filter api test:watch
pnpm --filter api test:cov
pnpm --filter api test:e2e
```

## Pre-commit hook

`pnpm install` runs the `prepare` script, which installs Husky hooks locally. The pre-commit hook
uses `lint-staged` to:

- format staged code and docs with Oxfmt
- lint staged JavaScript and TypeScript files with Oxlint autofix

## Environment variables

Each app has its own `.env.example` — everything lives in `apps/api/.env` and `apps/web/.env`, there
is no root `.env`. Copy both as shown in [Getting started](#getting-started).

**`apps/api/.env`** — read by the API and Prisma directly, and by `docker compose` (via
`--env-file apps/api/.env`, passed by the `pnpm db:up`/`pnpm db:down` scripts) to interpolate
`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and the host port in `docker-compose.yml`.
`DATABASE_URL` must be built by hand from those same values, since nothing keeps `DATABASE_URL` and
the `POSTGRES_*` vars in sync automatically:

```bash
POSTGRES_USER=pitstop
POSTGRES_PASSWORD=pitstop
POSTGRES_DB=pitstop
POSTGRES_PORT=5433
DATABASE_URL=postgresql://pitstop:pitstop@localhost:5433/pitstop
```

`POSTGRES_PORT` here drives both `DATABASE_URL` and the container's actual host port, via
`docker-compose.yml`'s interpolation (see [Local database](#local-database)) — keep them in sync by
hand if you change one.

`PORT` is optional and defaults to `3001`:

```bash
PORT=4000 pnpm dev:api
```

It also holds the Firebase Admin credentials, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY`:

```bash
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

Paste the private key exactly as it appears in the downloaded service-account JSON (a single-line,
quoted string with literal `\n` sequences); the code unescapes them at startup. See
[Firebase setup](#firebase-setup) for where to get these values.

**`apps/web/.env`** — read by Vite (default `envDir`, so nothing beyond this file needs
configuring). `VITE_API_URL` points the shared Axios client to the API and defaults to
`http://localhost:3001` in `.env.example`. The file also holds the web Firebase config:
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. See
[Firebase setup](#firebase-setup) for where to get these values.

Turborepo treats `.env*` files as build inputs. Keep local secrets in ignored `.env` files; never commit them.

## Database workflow

Run Prisma commands from the repository root. After changing files under `apps/api/prisma`, create and
apply the migration with `pnpm db:migrate`, then commit the generated migration directory with the
schema change. Run `pnpm db:generate` whenever you need to regenerate Prisma Client without creating a
migration.

Use `pnpm db:studio` to inspect local data in Prisma Studio. The command reads `DATABASE_URL` from
`apps/api/.env` and remains running until you stop it.
