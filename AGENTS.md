# Repository guidelines

## Project context

PitStop is a responsive web application (installable as a PWA) that centralizes vehicle maintenance:
users register their vehicles, keep a full service history, see recommended maintenance, and get
reminders so nothing is forgotten. It is the academic MVP for the Dirección de Proyectos course at
Universidad Austral, built by Lab2 students.

- The product UI is in Spanish. Code, comments, commits, and documentation are in English.
- The project runs on Scrum. Tickets are fullstack: one ticket is one complete vertical slice
  (web + API), never split into separate frontend and backend tickets.

In scope for the MVP:

- User accounts (sign up, sign in, account recovery).
- Managing multiple vehicles per user, with vehicle details (oil type, parts, etc.).
- Maintenance history: register services, browse them with different views, filtering and sorting.
- Recommended maintenance and maintenance alerts/reminders.

Out of scope: native iOS/Android apps, CarPlay/Android Auto, paid subscriptions, multi-language
support, ads, and a built-in catalog of every vehicle on the market.

Non-functional requirements that shape the code:

- Must work on desktop, tablet, and mobile browsers. Design every screen for both desktop and mobile.
- The interface targets users with no technical knowledge; keep flows short and obvious.
- The app should be installable as a PWA.

## Repository layout

```text
apps/api/          NestJS API, default port 3001 (src/ modules, test/ e2e specs)
apps/web/          Vite + React SPA, default port 3000
packages/          Reserved for shared workspace packages (empty today)
docs/              Setup documentation (Ponytail, CodeGraph)
turbo.json         Turborepo task graph and cache settings
.oxlintrc.json     Shared Oxlint configuration
.oxfmtrc.json      Shared Oxfmt configuration
pnpm-workspace.yaml  Workspace package globs
```

Where things go:

- SPA routes: `apps/web/src/routes/` (TanStack Router file-based routing).
- Global styles: `apps/web/src/styles.css` (Tailwind).
- API modules, controllers, and services: `apps/api/src/`.
- `apps/web/src/routeTree.gen.ts` is generated; never edit it by hand.

See [README.md](./README.md) for the full command reference.

## Tech stack

Only what is installed in the repository today:

| Area | Technology |
| --- | --- |
| Workspace | pnpm 11, Turborepo 2 |
| Language | TypeScript |
| API | NestJS 11 on Express |
| API tests | Jest, Supertest |
| Web | React 19, Vite 8, TanStack Router, TanStack Query, Tailwind CSS 4 |
| Lint / format | Oxlint, Oxfmt |

There is no ORM, database, authentication provider, or component library wired up yet.

**When you add a new dependency, tool, or external service (ORM, database, auth, UI library, …),
document it in this file in the same pull request that introduces it.** Update the table above and,
when the addition comes with rules of its own, the relevant convention section.

## Frontend conventions

### Calling the API

- Every request to the API goes through the shared Axios client in `apps/web/src`. Do not call
  `fetch` directly and do not create a new Axios instance per feature.
- If that shared client does not exist yet, create it once in a shared module
  (`apps/web/src/lib/api.ts`), read the base URL from an environment variable, and document it here.
- Wrap requests in TanStack Query hooks; it is already installed and is the caching layer for
  server state.

### Components

Follow this order and do not skip steps:

1. Look for a shadcn/ui primitive already present in the repository and reuse it.
2. If it is not present but shadcn/ui provides it, add it with the shadcn CLI instead of writing it
   by hand.
3. If shadcn/ui does not cover the case and the component is complex, recommend a library to the
   team before implementing anything.
4. Only when none of the above applies, write a new component from scratch.

Style with Tailwind utilities. Adapt shadcn/ui components to the prototype's visual identity rather
than forking them into unrelated one-off components.

### Text and icons

All UI text goes through the `Text` component and all icons through the `Icon` component. There are
no bare `<p>`, `<span>`, or `<h1>`-`<h6>` tags in application code, and no Tailwind classes for text
size or color at the call site.

```tsx
<Text variant="title">Mi garage</Text>
<Text variant="caption" color="muted">Ultimo servicio hace 3 meses</Text>
<Icon name="Car" size="md" color="muted" />
```

- `Text` takes a `variant` (the role of the text: `title`, `heading`, `body`, `label`, `caption`,
  `overline`, `numeric`, …) and a `color` token. Font family, size, weight, and tracking come from
  the variant; never pass `text-sm`, `text-xl`, or a hex color to override them. Use `as` when the
  semantic tag has to differ from the variant's default, and `className` only for spacing and width.
- `Icon` takes a lucide-react icon `name`, a `size` from the scale (`xs` 14px, `sm` 16px, `md` 20px,
  `lg` 24px, `xl` 28px), and the same `color` tokens as `Text`.
- Colors are always requested by token name (`primary`, `muted`, `danger`, …), never as a hex value.
  Tokens are defined once with `@theme` in `apps/web/src/styles.css`.

Oxlint enforces this with `react/forbid-elements`. The only file exempted is the `Text` component
itself, which is the one place allowed to render those tags; the exemption lives in `.oxlintrc.json`
under `overrides`. Do not disable the rule elsewhere — if a case seems to need it, the fix is a new
`Text` variant.

## Tooling

- Use pnpm; do not use npm or yarn.
- Run workspace commands from the repository root.
- Use Oxlint and Oxfmt. Do not add app-local ESLint, Prettier, Oxlint, or Oxfmt configuration without a concrete app-specific need.

## Verification

Before opening a pull request, run:

```bash
pnpm format
pnpm lint
pnpm check-types
pnpm build
```

Run API tests when changing the API:

```bash
pnpm --filter api test
pnpm --filter api test:e2e
```

## Documentation

- Read the relevant `docs/` documentation before making changes when it applies to the task.
- Reflect stack or convention changes in this file as part of the change that introduces them.

## Architecture

- Keep API changes within `apps/api` and web changes within `apps/web` unless a shared workspace concern requires otherwise.
- Keep generated TanStack Router route trees unchanged; they are generated artifacts.
