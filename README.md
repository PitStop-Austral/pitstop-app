# Pitstop Stack

A pnpm workspace managed by Turborepo. It contains a NestJS API and a React single-page application, with shared repository commands for development, builds, type checks, linting, and formatting.

## Stack

- **Workspace:** pnpm 11
- **Task runner:** Turborepo 2
- **API:** NestJS 11
- **Web:** React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS 4
- **Linting:** Oxlint
- **Formatting:** Oxfmt
- **Testing:** Jest (API)

## Repository layout

```text
.
├── apps/
│   ├── api/              # NestJS API (default port 3001)
│   └── web/              # Vite/React app (default port 3000)
├── packages/             # Reserved for shared workspace packages
├── .oxlintrc.json        # Shared Oxlint configuration
├── .oxfmtrc.json         # Shared Oxfmt configuration
├── pnpm-workspace.yaml   # Workspace package globs
├── turbo.json            # Turborepo task graph and cache settings
└── package.json          # Root scripts and development tooling
```

## Requirements

- A current Node.js release compatible with the application dependencies
- [pnpm 11](https://pnpm.io/installation) (the repository declares `^11.20.0`)

Install pnpm by following the [official pnpm installation documentation](https://pnpm.io/installation).

## Getting started

Create a new project from this template with [create-turbo](https://turborepo.dev/docs/reference/create-turbo):

```bash
pnpm dlx create-turbo@latest --example https://github.com/ManuLosta/pitstop-stack
```

Select the `pnpm` package manager when prompted. You can also clone the repository and run `pnpm install` in the root directory.

The generator prompts for the destination directory and installs dependencies. Then start every application:

```bash
cd <destination-directory>
pnpm dev
```

Open the web app at `http://localhost:3000`; the API listens on `http://localhost:3001` by default.

To start only one app:

```bash
pnpm dev:web
pnpm dev:api
```

## Turborepo

Turborepo runs commands across workspace packages and caches eligible tasks. The task graph lives in [`turbo.json`](./turbo.json).

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run all development servers. Persistent and never cached. |
| `pnpm build` | Build all applications in dependency order. |
| `pnpm check-types` | Type-check all workspace packages in dependency order. |

Run a task for one package with pnpm's filter syntax:

```bash
pnpm --filter web build
pnpm --filter api test
pnpm --filter api test:e2e
```

Run a Turborepo task directly when you need its flags:

```bash
pnpm exec turbo run build --filter=web
pnpm exec turbo run check-types --force
```

`--force` bypasses the local task cache. Use it only when verifying a build independently of cached results.

## Code quality

Run these commands from the repository root.

| Command | Purpose |
| --- | --- |
| `pnpm lint` | Check the whole repository with Oxlint. |
| `pnpm lint:fix` | Apply Oxlint autofixes where available. Review the diff afterwards. |
| `pnpm format` | Format files in place with Oxfmt. |
| `pnpm format:check` | Verify formatting without modifying files; suitable for CI. |
| `pnpm check-types` | Run TypeScript checks across the workspace. |

Recommended local verification before opening a pull request:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm build
```

For a non-mutating CI check, use:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm build
```

Oxlint and Oxfmt use the root configuration files, so do not add app-local ESLint, Prettier, Oxlint, or Oxfmt configuration without a concrete, app-specific need. Generated TanStack Router route trees are ignored by both tools.

## Tests

Jest belongs to the API package:

```bash
pnpm --filter api test
pnpm --filter api test:watch
pnpm --filter api test:cov
pnpm --filter api test:e2e
```

## Environment variables

The API reads `PORT` and defaults to `3001`:

```bash
PORT=4000 pnpm dev:api
```

Turborepo treats `.env*` files as build inputs. Keep local secrets in ignored `.env` files; never commit them.

## Useful pnpm commands

```bash
pnpm install             # Install every workspace dependency
pnpm update              # Update dependencies within their declared ranges
pnpm --filter web dev    # Run a package script directly
pnpm --filter api build  # Build only the API
```

Use `pnpm`, not npm or yarn, so the workspace and its lockfile stay consistent.
