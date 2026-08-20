# PitStop MVP

PitStop is a pnpm workspace managed by Turborepo. It contains the MVP web app and API for the
vehicle maintenance platform, plus the shared tooling the team uses locally and in pull requests.

## Stack

- **Workspace:** pnpm 11
- **Task runner:** Turborepo 2
- **API:** NestJS 11
- **Web:** React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS 4
- **Local database:** PostgreSQL 16 via Docker Compose
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
- [pnpm 11](https://pnpm.io/installation)
- Docker Desktop or a compatible local Docker engine

## Getting started

1. Clone the repository.
2. Copy `.env.example` to `.env` if you need local overrides.
3. Start PostgreSQL:

```bash
docker compose up -d
```

4. Install dependencies:

```bash
pnpm install
```

5. Start the web app and API together:

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

The local PostgreSQL instance uses the credentials published in `.env.example`:

```bash
DATABASE_URL=postgresql://pitstop:pitstop@localhost:5432/pitstop
```

You can connect from the host machine with `psql` or any database client using that URL.
Because the container uses a named volume, data survives `docker compose restart`.

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

| Command             | Purpose                                     |
| ------------------- | ------------------------------------------- |
| `pnpm dev`          | Run all development servers.                |
| `pnpm dev:web`      | Run only the web application.               |
| `pnpm dev:api`      | Run only the API.                           |
| `pnpm test`         | Run workspace tests.                        |
| `pnpm build`        | Build all applications in dependency order. |
| `pnpm check-types`  | Type-check all workspace packages.          |
| `pnpm lint`         | Check the repository with Oxlint.           |
| `pnpm lint:fix`     | Apply Oxlint autofixes where available.     |
| `pnpm format`       | Format files in place with Oxfmt.           |
| `pnpm format:check` | Verify formatting without modifying files.  |

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

The API reads `PORT` and defaults to `3001`:

```bash
PORT=4000 pnpm dev:api
```

Keep local secrets in ignored `.env` files; never commit real `.env` values.
