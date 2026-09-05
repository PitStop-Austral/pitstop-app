# Authentication & session (web)

## Route guards

- `_app.tsx` (protected layout): once the initial Firebase auth check resolves (`isLoading`), redirects to `/login` if there's no user, passing the current page as `?redirect=` so the user returns to it after logging in.
- `_auth.tsx` (auth layout): redirects an already-authenticated user away from `/login`/`/register` to `getSafeRedirect(search.redirect) ?? '/'`.

## Session source of truth

`AuthProvider` (`lib/auth-context.tsx`) is the only place that calls Firebase's `onAuthStateChanged`. `isLoading` resolves on the first callback; `user` reflects Firebase's current state everywhere else via `useAuth()`.

## Logout

`signOut()` (`lib/sign-out.ts`, wired up in `auth-context.tsx`) always runs, in this exact order: `firebaseSignOut(auth) → queryClient.clear() → navigate('/login', replace: true, search: {})` — identical for the manual "Cerrar sesión" button and the 401 handler, per the ticket. Non-obvious mechanisms live here — do not remove them as dead code or "simplify" them, they fix real, previously-shipped bugs:

- **`isSigningOut` flag** (`auth-context.tsx`): Firebase's `onAuthStateChanged(null)` fires _before_ `firebaseSignOut()`'s own promise resolves, so `_app.tsx`'s guard becomes eligible to fire its own competing redirect while `signOut()` is still mid-flight. `isSigningOut` suppresses the guard's redirect for the duration of any `signOut()` call, so only `signOut()`'s own `navigate()` ever writes the final URL.
- **`lastAuthedHrefRef`** (`_app.tsx`): tracks the last location seen _while authenticated_, updating on every render where `user` is truthy and freezing the instant it goes null. A plain `useRef(location.href)` captured once at mount goes stale once the user moves to a sibling page under the same layout; reading `location.href` live on every render instead re-nests the `redirect` search param during the transition itself, since each subsequent render sees the previous render's own in-flight redirect target. This pattern gets both properties at once.
- **In-flight dedup** (`lib/sign-out.ts`): the logout button and the 401 handler can both call `signOut()` around the same time (double-click, or a 401 landing mid-manual-logout). Without dedup, the first call's `finally` could flip `isSigningOut` back to `false` while the second is still awaiting `firebaseSignOut`/`navigate`, reopening the exact guard race above. `createSignOut` closes over an in-flight promise and returns it to any caller while a run is already active, instead of starting a second one. Covered by `lib/sign-out.test.ts`.

## Login / register bootstrap (`isAuthenticating`)

Firebase auth success (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`) is not the same as "fully logged in" here: both `login.tsx` and `register.tsx` also require a backend `/me` bootstrap (register additionally needs `updateProfile` + `getIdToken(true)` first) to succeed. Firebase sets `user` truthy _before_ that bootstrap even starts — `onAuthStateChanged` fires before the triggering SDK call's own promise resolves — so without `isAuthenticating`, `_auth.tsx`'s guard would redirect away mid-bootstrap, unmounting the route (and its mutation's error state) before a failing `/me` could ever render an error.

`isAuthenticating` (`auth-context.tsx`) suppresses only the guard's redirect branch — it must never swap `_auth.tsx`'s render to `<FullScreenLoader/>` instead, since that would unmount `<Outlet/>` and, with it, `login.tsx`/`register.tsx`'s own `useMutation` state (this was tried and reverted during development).

Login and register reset the flag differently, because their retry semantics differ:

- **Login** has no partial state worth preserving — every submit re-attempts `signInWithEmailAndPassword` from scratch. On any failure it also rolls back via `firebaseSignOut(auth)`, so `user` genuinely returns to `null` and the flag can simply reset in a `finally`.
- **Register** deliberately keeps the Firebase account alive across the "Reintentar" retry (`accountCreated` avoids re-calling `createUserWithEmailAndPassword`, which would otherwise fail with "email already in use"). Rolling back would break that retry design, so the flag instead stays `true` across failed attempts, resetting only in `onSuccess` — plus an unmount cleanup effect, in case the user abandons the retry loop by navigating away instead of retrying.

## Redirect sanitization

`getSafeRedirect()` (`lib/redirect.ts`) only accepts values starting with a single `/` — it rejects `//host` and `/\host` alike, since both are browser-equivalent to a protocol-relative URL (the WHATWG URL spec treats a leading backslash like a slash for special schemes).
