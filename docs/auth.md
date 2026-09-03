# Authentication & session (web)

## Route guards

- `_app.tsx` (protected layout): once the initial Firebase auth check resolves (`isLoading`), redirects to `/login` if there's no user, passing the current page as `?redirect=` so the user returns to it after logging in.
- `_auth.tsx` (auth layout): redirects an already-authenticated user away from `/login`/`/register` to `getSafeRedirect(search.redirect) ?? '/'`.

## Session source of truth

`AuthProvider` (`lib/auth-context.tsx`) is the only place that calls Firebase's `onAuthStateChanged`. `isLoading` resolves on the first callback; `user` reflects Firebase's current state everywhere else via `useAuth()`.

## Logout

`signOut()` always runs, in this exact order: `firebaseSignOut(auth) → queryClient.clear() → navigate('/login', ...)`. Two non-obvious mechanisms live here — do not remove them as dead code or "simplify" them, both fix real, previously-shipped bugs:

- **`isSigningOut` flag** (`auth-context.tsx`): Firebase's `onAuthStateChanged(null)` fires _before_ `firebaseSignOut()`'s own promise resolves, so `_app.tsx`'s guard becomes eligible to fire its own competing redirect while `signOut()` is still mid-flight. `isSigningOut` suppresses the guard's redirect for the duration of any `signOut()` call, so only `signOut()`'s own `navigate()` ever writes the final URL.
- **`lastAuthedHrefRef`** (`_app.tsx`): tracks the last location seen _while authenticated_, updating on every render where `user` is truthy and freezing the instant it goes null. A plain `useRef(location.href)` captured once at mount goes stale once the user moves to a sibling page under the same layout; reading `location.href` live on every render instead re-nests the `redirect` search param during the transition itself, since each subsequent render sees the previous render's own in-flight redirect target. This pattern gets both properties at once.

`signOut(options)` takes an optional `preserveLocation` flag (`lib/sign-out-navigation.ts`): the manual "Cerrar sesión" button omits it (clean `/login`, per product decision), while the 401 handler (`api-client.ts`) passes `preserveLocation: true` so the user returns to where they were after logging back in.

## Redirect sanitization

`getSafeRedirect()` (`lib/redirect.ts`) only accepts values starting with a single `/` — it rejects `//host` and `/\host` alike, since both are browser-equivalent to a protocol-relative URL (the WHATWG URL spec treats a leading backslash like a slash for special schemes).

## Debug helpers (dev only)

`window.__pitstopDebug` exposes `triggerUnauthorized()` (`api-client.ts`) and `forceSignOutFailure()` (`auth-context.tsx`) for exercising the 401 and sign-out-failure paths from the browser console without touching Firebase or the backend. Both are gated behind `import.meta.env.DEV` and confirmed removed from production builds by grepping `dist/` after `pnpm build`.
