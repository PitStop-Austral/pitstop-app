# PWA (installable app)

`apps/web` is installable as a Progressive Web App via `vite-plugin-pwa`, configured in
`apps/web/vite.config.ts`. The manifest declares `name`/`short_name` "PitStop", `lang: 'es'`,
`display: 'standalone'`, `theme_color: '#ffffff'`, `background_color: '#fafafa'`, and three icons in
`apps/web/public/`: `icon-192.png` and `icon-512.png` (`purpose: 'any'`), `icon-512-maskable.png`
(`purpose: 'maskable'`, extra margin so Android's icon mask doesn't crop the logo).

`registerType: 'autoUpdate'` means a newly deployed version replaces the cached one on the next
load automatically — no manual "update available" prompt. This requires the explicit
`registerSW({ immediate: true })` call in `apps/web/src/main.tsx` (imported from the
`virtual:pwa-register` module, typed via the `vite-plugin-pwa/client` reference in
`apps/web/src/vite-env.d.ts`); `registerType: 'autoUpdate'` alone only configures the generated
service worker's update behavior, it does not register it. Only the static shell (HTML/CSS/JS) is
precached by the generated service worker; API requests are never cached and still require a
network connection.

iOS only picks up an icon and standalone mode from `<link>`/`<meta>` tags in `apps/web/index.html`,
not from the manifest: `<link rel="apple-touch-icon">` (180x180), `apple-mobile-web-app-capable`,
`apple-mobile-web-app-status-bar-style: black-translucent` (draws app content behind the status
bar instead of a solid white strip), and `viewport-fit=cover` on the viewport meta so content can
extend under the notch/status bar. The same viewport meta carries `maximum-scale=1,
user-scalable=no` to disable pinch-zoom; `body` adds `touch-action: manipulation` to drop the
double-tap-zoom delay. Together with the explicit `text-base` (16px) on `Input`, `SelectTrigger`
and `SelectItem`, this is what stops iOS from auto-zooming when a field takes focus — WebKit zooms
any focused control whose font is under 16px, and the zoom stays applied across navigations.

## Viewport height in standalone mode

Do not size full-height containers with `dvh`. On a standalone-PWA cold launch WebKit resolves
`dvh` against stale viewport metrics and only corrects it after a real touch, which leaves the
layout visibly misplaced until the user interacts. Standalone mode has no collapsing toolbar, so
`vh` and `dvh` settle on the same number — but `vh` is correct from the first paint.

`apps/web/src/styles.css` encodes that as `--app-height`, which is `100dvh` by default and `100vh`
under `@media (display-mode: standalone)`, exposed through the `h-app`/`min-h-app` utilities. Use
those for anything that fills the viewport. Browser tabs keep `dvh`, where the collapsing toolbar
makes it the right unit.

## Mobile app shell

`apps/web/src/routes/_app.tsx` is a fixed-height shell (`h-app` + `overflow-hidden`) rather than a
scrolling document: `AppHeader` and `BottomNav` are static flex children, and only
`<main id="app-scroll">` scrolls. The nav is deliberately not `position: fixed` — WebKit computes
fixed offsets from the same stale metrics described above. Sticky offsets inside routes are
therefore relative to the scroll container, not the window (see the Garage tabs' `sticky top-0`).

Because the document itself no longer scrolls, TanStack Router's `scrollRestoration` currently has
no effect; wiring it to `#app-scroll` is outstanding work.

Modal scroll locking lives in `useNativeDialog` (`apps/web/src/components/ui/dialog-container-context.tsx`),
which is reference-counted so nested sheets don't unlock early. It sets `overflow: hidden` on
`#app-scroll` and `touch-action: none` on `body`. A modal `<dialog>` sits in the top layer as a
`position: fixed` box, so its scroll chain skips `#app-scroll` and ends at the root — hence the
extra `touch-none` on the `<dialog>` elements themselves, which covers drags on a sheet's own
header, footer and padding. The `touch-action` intersection walk stops at the first scrolling
ancestor, so a sheet's inner scroll area is unaffected by those rules. That area also gets
`overscroll-contain`, plus a runtime `touch-action: none` in `BottomSheet` whenever its content
fits without overflowing, because WebKit ignores `overscroll-behavior` on a container that is not
actually scrollable and hands the drag to the root instead.

The service worker only registers over HTTPS or `localhost`, so it never runs under `pnpm dev`.
Test it locally with `pnpm --filter web build && pnpm --filter web preview` in an incognito window
(a stale service worker from a previous test otherwise stays registered).
