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
│   ├── api/              # NestJS API (default port 3001)
│   └── web/              # Vite/React app (default port 3000)
├── packages/             # Reserved for shared workspace packages
├── docker-compose.yml    # Local PostgreSQL for development
├── .env.example          # Example environment variables
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
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL:

```bash
docker compose up -d
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
docker compose down
```

To stop and remove the local database including its volume:

```bash
docker compose down -v
```

## Local database

The local PostgreSQL instance uses the credentials published in `.env.example`. Docker Compose
uses the same values for `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`:

```bash
DATABASE_URL=postgresql://pitstop:pitstop@localhost:5433/pitstop
```

You can connect from the host machine with `psql` or any database client using that URL.
PostgreSQL uses host port `5433` by default to avoid conflicts with an existing local installation;
set `POSTGRES_PORT` and update `DATABASE_URL` in `.env` if you need another port. Because the
container uses a named volume, data survives `docker compose restart`.

## Team workflow

- Branch names follow `feat/PIT-XX-description` for feature work unless the ticket calls for a
  different prefix.
- Open a pull request against the default branch when the ticket is ready for review.
- Ask for review from the team members responsible for the affected area and wait for approval
  before merging.

Definition of done for repository-level setup work:

- The local database starts with `docker compose up -d`.
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

The API and Prisma require `DATABASE_URL`. The local default is provided in `.env.example`:

```bash
DATABASE_URL=postgresql://pitstop:pitstop@localhost:5433/pitstop
```

The API also reads `PORT` and defaults to `3001`:

```bash
PORT=4000 pnpm dev:api
```

Turborepo treats `.env*` files as build inputs. Keep local secrets in ignored `.env` files; never commit them.

## Database workflow

Run Prisma commands from the repository root. After changing files under `apps/api/prisma`, create and
apply the migration with `pnpm db:migrate`, then commit the generated migration directory with the
schema change. Run `pnpm db:generate` whenever you need to regenerate Prisma Client without creating a
migration.

Use `pnpm db:studio` to inspect local data in Prisma Studio. The command reads `DATABASE_URL` from the
root `.env` file and remains running until you stop it.
