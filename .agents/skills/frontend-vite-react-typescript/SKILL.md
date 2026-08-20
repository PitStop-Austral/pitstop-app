---
name: frontend-vite-react-typescript
description: Frontend development conventions for Vite + React + TypeScript. Apply whenever implementing or modifying a feature that touches the frontend.
---

# Frontend Development — Vite + React + TypeScript

Use this skill whenever a task requires creating, modifying, or refactoring frontend code in a Vite + React + TypeScript project.

## Core principles

### 1. Reuse before creating

- Always inspect the existing codebase before creating a component, hook, utility, type, or pattern.
- Reuse existing components whenever they satisfy the requirement.
- Do not create duplicates with slightly different names or APIs.
- Only create a new component when a suitable existing component does not exist.
- Prefer extending an existing component in a backwards-compatible way over creating a parallel component.

### 2. Componentization and SOLID

- Follow SOLID principles where applicable, especially Single Responsibility and Open/Closed.
- Prefer small, focused components over large components with mixed responsibilities.
- Extract reusable UI, logic, and stateful behavior when a component becomes difficult to reason about.
- Keep presentation, business logic, and data-fetching concerns separated when practical.
- Avoid premature abstraction: extract something when there is real reuse or a clear responsibility boundary.
- Keep props intentional and minimal; avoid passing large objects when only a few fields are needed.

### 3. UI components: shadcn first

When a new UI component is genuinely necessary:

1. Check whether shadcn/ui already provides the component.
2. If it does, use the shadcn component and adapt it through supported props/composition.
3. If shadcn does not provide it, implement it with the project's existing primitives/patterns.
4. For complex specialized components, a different library may be considered, but **ask for approval before installing any new dependency**.
5. Never add a new UI library silently.

Prefer composition of existing primitives over introducing custom abstractions.

### 4. Impeccable skills

- Use the installed Impeccable skills whenever they are relevant to the frontend task.
- Follow their guidance for visual quality, spacing, hierarchy, layout, accessibility, interaction, and UI consistency.
- Do not bypass an applicable Impeccable skill just because an implementation already exists.

### 5. Text and icons

- Always use the existing `Text` component for user-facing text.
- Always use the existing `Icon` component for icons.
- Use only valid props/variants supported by those components.
- Do not replace them with raw text elements or ad-hoc icon implementations unless the existing design system explicitly requires it.
- Do not introduce a second text or icon abstraction without a strong, documented reason.

### 6. Design tokens are mandatory

- Reuse the existing color, typography, spacing, radius, shadow, and other design tokens.
- Never hardcode hexadecimal colors in components/styles.
- Avoid raw color literals such as `rgb()`, `rgba()`, `hsl()`, or named colors when an existing token is available.
- Do not create one-off typography styles that bypass the design system.
- Never override a `Text` variant just to achieve a local visual result; use an existing variant or discuss extending the design system.
- Match existing spacing and visual patterns before inventing new ones.

### 7. TypeScript quality

- Keep the implementation strongly typed and predictable.
- Reuse existing domain types whenever possible.
- Avoid `any`; use explicit types, generics, unions, or `unknown` with proper narrowing instead.
- Avoid unnecessary type assertions (`as`) and non-null assertions (`!`).
- Type component props explicitly.
- Prefer discriminated unions for components with multiple valid states.
- Keep API/data types separate from UI-specific types when their responsibilities differ.
- Make invalid states difficult to represent through the type system.

## React conventions

- Prefer functional components and hooks.
- Keep components pure where possible.
- Follow the Rules of Hooks.
- Do not use `useEffect` for derived values that can be computed during render.
- Avoid unnecessary local state; derive values from props/state when possible.
- Keep effects narrowly scoped to actual side effects.
- Use stable keys when rendering lists; never use array indexes when a stable identifier exists.
- Prefer composition over deeply nested conditional rendering.
- Avoid prop drilling when a sensible existing context or composition pattern already exists, but do not introduce context just to avoid passing one or two props.

## Project architecture

- Respect the existing folder/module structure.
- Place new files beside related functionality when the project convention supports colocating code.
- Follow existing naming conventions for components, hooks, utilities, types, and files.
- Avoid moving or renaming unrelated code during a feature implementation.
- Keep changes focused on the feature; do not refactor the entire area unless required.

## Styling

- Reuse the project's existing styling approach and conventions.
- Prefer existing utility classes, variants, and style helpers over custom CSS.
- Do not add arbitrary values when an existing token or utility already solves the problem.
- Keep responsive behavior consistent with existing screens.
- Do not introduce layout patterns that conflict with established page-level structure.

## Accessibility

- Use semantic HTML where appropriate.
- Ensure interactive elements are keyboard accessible.
- Provide accessible labels for icon-only buttons and controls.
- Do not use color as the only way to communicate meaning.
- Respect existing focus, disabled, loading, and error states.
- Reuse accessible shadcn primitives instead of rebuilding interaction behavior from scratch.

## State, data, and behavior

- Reuse existing hooks, services, query utilities, and state-management patterns.
- Do not introduce a new state-management solution for a local problem.
- Keep server/data concerns outside purely presentational components when the architecture allows it.
- Handle loading, empty, error, and success states intentionally when the feature needs them.
- Avoid duplicate requests, duplicated transformation logic, and duplicated validation.

## Dependencies

Before adding a package:

- Check whether the project already has an equivalent dependency.
- Check whether the functionality can be implemented with existing code or shadcn.
- **Ask for approval before installing a new dependency or UI library.**
- Do not modify package versions unrelated to the task.

## Validation before finishing

Before considering the feature complete:

- Verify existing components were reused where appropriate.
- Verify no duplicate component was introduced unnecessarily.
- Verify new UI uses shadcn when an equivalent exists.
- Verify all user-facing text uses `Text`.
- Verify all icons use `Icon`.
- Verify existing design tokens are used instead of hardcoded colors/typography.
- Verify no `any` or unnecessary type assertions were introduced.
- Verify loading, empty, error, disabled, and responsive states where relevant.
- Verify accessibility for interactive elements.
- Run the project's available typecheck, lint, and tests relevant to the change.
- Keep the final diff focused and remove dead code introduced during implementation.

## Decision rule

When choosing between two implementations, prefer the one that:

1. Reuses the existing design system and components.
2. Reuses existing project patterns and dependencies.
3. Is smaller and easier to maintain.
4. Has stronger TypeScript guarantees.
5. Has clearer component responsibilities.
6. Introduces fewer new abstractions and dependencies.
