# smart-streamer-plugin

The Smart Streamer product surface for the Jenix One PWA, built and
deployed as its own artifact — **not** part of the `web-pwa` app's build.
This is deliberate: a customer who doesn't own a Smart Streamer never
downloads a byte of this code, and this project can be developed, tested,
and released independently of the core platform's release train.

## How it loads

The platform already has a runtime plugin mechanism (`window.__JENIX_
DEVICE_PACKAGE_HOST__`, see `PWA_APK/apps/web-pwa/src/features/devices/
plugins/devicePackageRegistry.ts`), proven in production for Tank Guard's
per-device control card. This project produces a single self-registering
script (`dist/remoteEntry.js`) using that exact same mechanism, generalized
by the host's new `RemoteProductMount` component to mount a **whole
product section** (multiple internal pages) instead of one device card.

At runtime: the host fetches `remoteEntry.js` via a `<script>` tag only
when the user navigates to `/streamer`, the script calls
`host.registerPackage(...)`, and the host resolves + renders the exported
`SmartStreamerApp` component.

## Why no React import

`src/host.ts` pulls `React` from `window.__JENIX_DEVICE_PACKAGE_HOST__` at
runtime rather than bundling a copy — two separate React instances in one
page breaks hooks. Every file imports `{ React }` from `./host` instead of
the `react` package; JSX compiles against that binding via
`jsxFactory: "React.createElement"` in `tsconfig.json`/`build.mjs`. Type
information still comes from `@types/react` (a devDependency, type-only —
nothing is bundled from it).

## Why no router

Sections (Overview, Devices, Cameras, ...) are switched with local
component state in `SmartStreamerApp.tsx`, not URL routes. Sharing
`react-router-dom` across the host/remote boundary the way `React` is
shared would need the host to expose that module too — real, currently
does not exist. Until then, `/streamer/<section>` isn't individually
deep-linkable; `/streamer` itself is a real route. Revisit if deep-linking
becomes a real product requirement.

## Build

```
npm install
npm run typecheck
npm run build        # -> dist/remoteEntry.js + dist/manifest.json
```

## Publishing to the platform (once the VPS side exists)

1. Register `packageId: "smart-streamer-plugin"` via
   `POST /api/v1/admin/ui-packages`, add version `1.0.0`, publish it
   (`VPS/apps/api-server/src/modules/ui-packages/`).
2. Copy `dist/remoteEntry.js` + `dist/manifest.json` to wherever that
   module serves package assets from (mirrors how
   `PWA_APK/apps/web-pwa/public/ui-packages/tank-guard-mobile/1.0.0/`
   is served today).
3. Bind the `STREAMER` PID family's `uiMode` to `"remote-package"`
   pointing at this package (`HomeUiBootstrapPidBinding`).
4. Remove the hardcoded `SMART_STREAMER_PACKAGE` constant in
   `web-pwa/src/features/streamer/StreamerRoute.tsx` and read the real
   package record from the home-bootstrap response instead.

Until step 1–3 happen, `dist/remoteEntry.js` and `dist/manifest.json` can
be copied directly into `web-pwa/public/ui-packages/smart-streamer-
plugin/1.0.0/` for local development — that's what the host's hardcoded
`entryPath` currently points at.
