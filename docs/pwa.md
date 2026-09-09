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
extend under the notch/status bar.

The service worker only registers over HTTPS or `localhost`, so it never runs under `pnpm dev`.
Test it locally with `pnpm --filter web build && pnpm --filter web preview` in an incognito window
(a stale service worker from a previous test otherwise stays registered).
