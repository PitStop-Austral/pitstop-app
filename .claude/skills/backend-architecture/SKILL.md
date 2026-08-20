---
name: backend-architecture
description: >
  Architecture, Prisma, and workflow rules for the Changuito API (NestJS 11 + Prisma + PostgreSQL) in
  apps/api. Use when writing, reviewing, or refactoring anything under apps/api — modules, controllers,
  services, repositories, DTOs, Prisma schema, migrations, or Jest tests — and when wiring Prisma into
  the API for the first time. Holds the project-specific decisions; the framework-level rules live in
  the nestjs-best-practices skill.
license: MIT
metadata:
  author: martinbarreiro
  version: "2.0.0"
---

# Backend Architecture — Changuito API

Project-specific rules for `apps/api`. Everything here is scoped to **this** repository
(`pitstop-stack` / Changuito). Generic NestJS advice lives in the companion skill
[`nestjs-best-practices`](../nestjs-best-practices/SKILL.md) — this file says which of its rules apply
and overrides them where the project decided otherwise.

---

## 1. Sources of truth (in precedence order)

| # | Source | What it settles |
|---|--------|-----------------|
| 1 | [`SPEC.md`](../../../SPEC.md) | Product behavior, data model, API contract, status codes. Linear tickets reference it. **If something is not in SPEC.md, ask — do not invent it.** |
| 2 | [`AGENTS.md`](../../../AGENTS.md) | Tooling, package manager, verification commands. |
| 3 | This skill | Internal architecture of the API (layering, file layout, Prisma conventions). |
| 4 | `nestjs-best-practices` | Framework-level rules when 1–3 are silent. |

**Conflict rule:** SPEC beats this skill; this skill beats generic NestJS advice. When SPEC and a
"best practice" disagree, follow SPEC and say so in the PR instead of silently improving the contract.

---

## 2. Companion skills — load which, when

| Skill | Load it when |
|-------|--------------|
| `nestjs-best-practices` | Any `apps/api` work. Open the specific `rules/*.md` files mapped in §10 — do not read all 40. |
| `tdd` | The ticket has real logic (e.g. `computeSuggestions`, close-list totals). Red → green, one seam at a time. |
| `feature-planning` | Anything beyond a one-file change. Requires Plan Mode; plan and get approval before writing code. |
| `commit-local-changes` | Creating the commit at the end of the ticket. |
| `context7-mcp` | Before writing Prisma/NestJS API surface you have not verified this session. Prisma 7 broke several defaults — see §6. |
| CodeGraph (`codegraph explore "<symbol or question>"`) | Locating existing code. Reach for it before `grep`/`find`. |

---

## 3. Repo reality check — verify, do not assume

These are the traps that have burned sessions. Confirm with `cat apps/api/package.json` before assuming
anything about installed libraries.

| Fact | Not |
|------|-----|
| API lives in `apps/api/` | ~~`apps/backend/`~~ |
| Package manager is **pnpm** (root `devEngines`, `AGENTS.md`) | ~~npm~~, ~~yarn~~ |
| Lint = **Oxlint**, format = **Oxfmt**, root config only | ~~ESLint~~, ~~Prettier~~, ~~app-local config~~ |
| Type check = `pnpm check-types` (turbo → `tsc --noEmit`) | ~~`npx tsc` inside the app~~ |
| Tests = Jest, `rootDir: src`, `testRegex: .*\.spec\.ts$` | — |
| **No auth, no users, no tenancy** during the capacitación (SPEC §1) | ~~`JwtAuthGuard`~~, ~~`@Public()`~~, ~~`@CurrentUser()`~~ |
| Postgres runs via `docker compose up -d` at the repo root | ~~a globally installed psql~~ |
| `packages/` is reserved and empty — there is no shared types package yet | ~~importing from `@repo/*`~~ |

At the time of writing `apps/api/src` is still the plain Nest 11 scaffold (`main.ts`, `app.module.ts`,
`app.controller.ts`, `app.service.ts`) and **Prisma is not installed**. §6 is the wiring recipe.

---

## 4. Module layout

Domain modules under `apps/api/src/modules/`. SPEC §7 fixes the four domains:

```text
apps/api/
├── prisma/
│   ├── schema.prisma          # generator + datasource ONLY
│   ├── models/                # one file per model (+ its enums)
│   └── migrations/            # generated; never hand-edited
├── src/
│   ├── main.ts                # global prefix + global ValidationPipe
│   ├── app.module.ts
│   ├── prisma/                # PrismaModule (@Global) + PrismaService
│   └── modules/
│       ├── lists/
│       │   ├── lists.controller.ts
│       │   ├── lists.service.ts
│       │   ├── lists.repository.ts
│       │   ├── lists.mapper.ts        # Prisma row → API response (Decimal → number)
│       │   ├── dto/
│       │   │   ├── create-list.dto.ts
│       │   │   ├── update-list.dto.ts
│       │   │   └── close-list.dto.ts
│       │   └── lists.module.ts
│       ├── items/
│       ├── history/
│       └── suggestions/
│           └── suggestions.logic.ts   # pure computeSuggestions(), no Nest, no Prisma
└── test/                              # e2e specs + jest-e2e.json
```

Pure domain logic goes in a `*.logic.ts` file with no framework imports so it can be unit-tested
without a testing module. `computeSuggestions(purchases, openItemNames, today)` (SPEC §5) is the
canonical example.

---

## 5. The layering contract

| Layer | Does | Never |
|-------|------|-------|
| **Controller** | Declares the route, binds DTOs/params, returns what the service gives back. | Touches Prisma. Contains branching business rules. Builds response shapes by hand. |
| **Service** | Business rules, invariants, orchestration, mapping to the response shape. Throws `HttpException` subclasses. | Touches `req`/`res`. Calls `PrismaService` directly. |
| **Repository** | Every Prisma call and every `$transaction`. Returns Prisma model types. | Throws HTTP exceptions. Knows about DTOs or response shapes. |

SPEC §7 only requires "thin controller, logic in the service". The **repository layer is this team's
convention on top of it** — keep it even for one-line queries; it is what makes the service unit-testable
without a database. See `nestjs-best-practices/rules/arch-use-repository-pattern.md`.

```ts
// lists.service.ts — invariants live here, Prisma does not
async close(listId: string, dto: CloseListDto) {
  const list = await this.listsRepository.findById(listId);
  if (!list) throw new NotFoundException(`List ${listId} not found`);
  if (list.status === ListStatus.CLOSED) {
    throw new ConflictException(`List ${listId} is already closed`);
  }
  const closed = await this.listsRepository.closeWithPrices(listId, dto.items);
  return toClosedListResponse(closed);
}
```

Registration: one `@Module` per domain, providers `[Service, Repository]`, export only what another
module genuinely needs. Constructor injection only (`rules/di-prefer-constructor-injection.md`). If two
modules start importing each other, stop and restructure — do not reach for `forwardRef`
(`rules/arch-avoid-circular-deps.md`).

---

## 6. Prisma

### 6.1 Before touching Prisma, check the installed major

```bash
cat apps/api/package.json | grep -E '"(prisma|@prisma/client)"'
```

Prisma **7** changed defaults that agents get wrong from memory. If v7 is installed:

```prisma
// prisma/schema.prisma — generator + datasource only
generator client {
  provider = "prisma-client"      // NOT "prisma-client-js"
  output   = "../generated/prisma" // mandatory in v7
}

datasource db {
  provider = "postgresql"          // url moved to prisma.config.ts in v7
}
```

```ts
// prisma.config.ts (repo-root level for the api package)
import 'dotenv/config'; // must be the first import
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

The client is then imported from the generated path (`../generated/prisma/client`), **not** from
`@prisma/client`. On Prisma 6 the classic `prisma-client-js` + `@prisma/client` import still applies.
Confirm with Context7 (`/prisma/skills` or `/websites/prisma_io`) before scaffolding — do not write the
generator block from memory.

`DATABASE_URL` for local dev (README): `postgresql://changuito:changuito@localhost:5432/changuito?schema=public`.

### 6.2 Schema organization

Multi-file schema: `schema.prisma` at the root of the schema directory holds **only** `generator` +
`datasource`; each model gets its own file under `models/` with its enums beside it
(`ListStatus` → `shopping-list.prisma`; `Unit` and `Category` → `list-item.prisma`). `migrations/` must
sit at the same level as `schema.prisma`.

### 6.3 Rules that come straight from SPEC §3

- Money and quantities are `Decimal` (`@db.Decimal(10, 2)`), **never `Float`**. Convert to `number` in
  the mapper at the API boundary (`price.toNumber()`), never in the controller.
- `normalizedName` is computed by the backend (`name.trim().toLowerCase()`) in the service. The
  frontend never sends it and the API never returns it — strip it in the mapper.
- Deleting a list deletes its items via `onDelete: Cascade`; do not emulate it in code.
- `POST /lists/:id/close` is one interactive transaction: update prices, delete unchecked items, flip
  status. Rolls back as a unit.

```ts
// lists.repository.ts — transactions live in the repository
return this.prisma.$transaction(async (tx) => {
  await tx.listItem.deleteMany({ where: { listId, isChecked: false } });
  for (const item of items) {
    await tx.listItem.update({ where: { id: item.id }, data: { actualPrice: item.actualPrice } });
  }
  return tx.shoppingList.update({
    where: { id: listId },
    data: { status: ListStatus.CLOSED, closedAt: new Date() },
    include: { items: true },
  });
});
```

### 6.4 Migrations

```bash
pnpm --filter api exec prisma migrate dev --name <kebab-slug>
pnpm --filter api exec prisma generate
```

Never hand-edit a file under `migrations/`. Never run `migrate reset` / `db push` on a ticket without
asking first — it wipes local data. Schema change and its migration land in the same commit
(`rules/db-use-migrations.md`).

### 6.5 PrismaService

One `@Global()` `PrismaModule` exporting a `PrismaService extends PrismaClient` that connects in
`onModuleInit`. Nothing else in the codebase instantiates a `PrismaClient`.

### 6.6 Queries

Use `select`/`include` deliberately: `GET /lists` needs `itemCount`, `checkedCount` and
`estimatedTotal` — get them with `_count` / aggregation or a single `include`, not a query per list
(`rules/db-avoid-n-plus-one.md`, `rules/perf-optimize-database.md`).

---

## 7. HTTP contract fidelity

- Base path is `/api` — `app.setGlobalPrefix('api')` in `main.ts`.
- Global validation in `main.ts`:
  `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.
  `whitelist: true` is required by SPEC §7; the other two catch typo'd payloads and give DTOs their real
  types.
- Every request body has a `class-validator` DTO. `PATCH` DTOs use `PartialType(CreateXDto)`, not a
  hand-copied optional clone (`rules/security-validate-all-input.md`).
- **Route params follow SPEC verbatim.** SPEC uses `/lists/:id`, `/lists/:id/items`, `/items/:id`. Do not
  "improve" them to `:listId`. For an endpoint that is *not* in SPEC, use a descriptive param name and
  flag the addition in the PR — SPEC is the contract the frontend codes against.
- Status codes are contract, not taste: `201` on create, `204` on delete (`@HttpCode(204)`), `409` on
  any mutation of a `CLOSED` list, `404` when the id does not exist.
- Errors are NestJS exceptions — `NotFoundException`, `ConflictException`, `BadRequestException`. Never a
  raw `throw new Error()` in a service (`rules/error-throw-http-exceptions.md`).

---

## 8. Strict standards

- **No `any`.** Use the generated Prisma types or a specific interface; `unknown` + narrowing at the edges.
- **No `console.log`.** Use the built-in NestJS `Logger` with the class name as context. No logging library
  is installed and SPEC §2 forbids adding one without TL approval.
- **No new dependencies** without asking. That includes `nestjs-pino`, `@nestjs/config`, `helmet`, mappers,
  and validation alternatives. SPEC §2: "No se agregan librerías sin aprobación del TL."
- **No app-local tooling config.** `AGENTS.md` forbids adding ESLint/Prettier/Oxlint/Oxfmt config inside
  `apps/api`.
- Keep API changes inside `apps/api`; web changes belong to `apps/web`.

---

## 9. Testing

- Unit specs sit next to the source (`lists.service.spec.ts`) — Jest's `rootDir` is `src`.
- E2E specs live in `apps/api/test/` and run with `jest-e2e.json`.
- Service tests mock the repository via `Test.createTestingModule` + a provider override — never hit a
  real database (`rules/test-use-testing-module.md`, `rules/test-mock-external-services.md`).
- Pure logic (`computeSuggestions`) is tested as a plain function with worked examples, no testing module.
- Expected values come from the SPEC, not from re-running the implementation's own arithmetic.

```bash
pnpm --filter api test
pnpm --filter api test:watch
pnpm --filter api test:e2e
```

---

## 10. `nestjs-best-practices` rule index

Open the rule file for the task at hand; do not read the whole skill.

| Task | Rules to open |
|------|---------------|
| New module / splitting a service | `arch-feature-modules`, `arch-single-responsibility`, `arch-module-sharing` |
| Wiring providers | `di-prefer-constructor-injection`, `di-scope-awareness` |
| Repository work | `arch-use-repository-pattern`, `db-use-transactions`, `db-avoid-n-plus-one` |
| Schema change | `db-use-migrations` |
| DTOs / request payloads | `security-validate-all-input`, `api-use-dto-serialization`, `api-use-pipes` |
| Error paths (404/409) | `error-throw-http-exceptions`, `error-use-exception-filters`, `error-handle-async-errors` |
| Slow endpoint | `perf-optimize-database`, `perf-use-caching` |
| Tests | `test-use-testing-module`, `test-e2e-supertest`, `test-mock-external-services` |
| Health check / shutdown | `micro-use-health-checks`, `devops-graceful-shutdown` |

**Deliberately not applicable here:** every `security-auth-*` / `security-use-guards` rule (no auth in
this capacitación), `api-versioning` (the contract is `/api`, unversioned), and the `micro-*` queue and
message-pattern rules (single service). If auth ever enters the SPEC, revisit `security-auth-jwt`,
`security-use-guards`, and `security-rate-limiting` before designing anything.

---

## 11. Mandatory validation gate

After **any** change under `apps/api`, from the repository root:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm build
pnpm --filter api test
pnpm --filter api test:e2e   # when API behavior changed
```

- `pnpm` only. `npm install` here corrupts the workspace lockfile.
- Verify behavior yourself: `docker compose up -d`, `pnpm dev:api`, then `curl http://localhost:3001/api/...`
  or query the DB through the container. Do not ask for pasted responses or screenshots when the check is
  scriptable.
- Never report a check as passing unless it actually ran. If something fails and is out of scope, say so
  explicitly rather than silently skipping it.

---

## 12. Ticket workflow

1. **Read the ticket** (Linear) *and* the SPEC section it references. Ambiguity in the ticket is resolved
   by SPEC; ambiguity in SPEC is escalated, not invented.
2. **Plan** with `feature-planning` (Plan Mode) for anything bigger than a one-file change. Stop for
   approval before implementing.
3. **Branch** `feat/PIT-XX-descripcion-corta` (SPEC §7).
4. **Implement** in this order so each step compiles: schema + migration → repository → service →
   controller + DTOs → mapper → tests.
5. **Validate** with §11.
6. **Commit** with `commit-local-changes` (Conventional Commits, English, scope = `api`).
7. **PR** describes what it does and how to test it manually (SPEC §7).

When investigating reported misbehavior: **explain the cause first, then edit.** No speculative fixes, and
no "fixed" claim until the observed behavior actually changed.

---

## 13. Anti-patterns already caught in this repo

| Wrong | Right |
|-------|-------|
| `apps/backend/src/modules/...` | `apps/api/src/modules/...` |
| `npm run lint`, `npx tsc --noEmit` | `pnpm lint`, `pnpm check-types` |
| ESLint/Prettier scripts, `nestjs-pino` | Oxlint/Oxfmt, built-in `Logger` |
| `JwtAuthGuard`, `@Public()`, `@CurrentUser()` | No auth exists — delete the guard, do not stub it |
| `Float` for prices | `Decimal @db.Decimal(10, 2)`, `.toNumber()` in the mapper |
| Returning the raw Prisma row | Mapper: `Decimal` → `number`, drop `normalizedName` |
| `:clientId`-style renames of SPEC routes | Match SPEC verbatim; propose changes in the PR |
| Prisma calls inside a service or controller | Repository only |
| Hand-editing a migration file | `prisma migrate dev --name ...` |
| `generator client { provider = "prisma-client-js" }` written from memory | Check the installed major; Prisma 7 uses `prisma-client` + mandatory `output` |
