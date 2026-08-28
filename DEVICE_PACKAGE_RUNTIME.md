# Jenix One Device Package Runtime

This document explains why the dynamic device-package runtime was added, how it currently works, and what a new developer should touch next.

## Goal

Jenix One should stay a thin platform shell while device-specific pages are loaded only when a HOME actually owns that device type.

Current examples:
- PID: `JNX-TG-C3-001`, package: `tank-guard-mobile@1.0.0` (per-device dynamic page, hand-written)
- PID: `JNX-QRU-C3-001`, package: `qrunlock-mobile@1.0.0` (full routed product package, real TSX build -- see "Two ways to build a package" below)

## Why this was added

Before this work, device detail rendering was effectively platform-owned and tightly coupled. That does not scale well when:
- multiple device types need custom pages
- each product evolves on its own release cadence
- the main PWA bundle should stay small
- per-PID rollout and rollback are needed

The chosen direction is:
- common shell in `jenix One`
- PID-specific UI packages delivered dynamically
- published package artifacts stored separately from platform source

## Current architecture

### Shared contracts

Paths:
- `packages/shared/src/types/ui-bootstrap.ts`
- `packages/shared/src/types/device-ui-runtime.ts`

Responsibilities:
- define which package a PID/home/device should use
- define the device runtime payload consumed by remote pages
- keep frontend and backend in sync

### Backend package selection

Paths:
- `VPS/apps/api-server/src/modules/homes/home.service.ts`
- `VPS/apps/api-server/src/modules/ui-packages/ui-package.catalog.ts`

Responsibilities:
- build HOME bootstrap with PID bindings and package records
- map `packageId + version` to `manifestPath`, `entryPath`, and `exportName`

### Frontend route loading

Paths:
- `PWA_APK/apps/web-pwa/src/features/home/HomeDashboardPage.tsx`
- `PWA_APK/apps/web-pwa/src/features/devices/DeviceDetailPage.tsx`
- `PWA_APK/apps/web-pwa/src/features/devices/components/PidDynamicPageRenderer.tsx`
- `PWA_APK/apps/web-pwa/src/features/devices/plugins/devicePackageRegistry.ts`

Responsibilities:
- `/home` opens `/devices/:deviceId` directly
- device detail resolves the HOME bootstrap package record
- browser loads `/ui-packages/.../remoteEntry.js`
- remote script registers the exported React page

### Two ways to build a package

**Per-device dynamic page** (`tank-guard-mobile`, `sos-siren-mobile`, `p10-display-mobile`, `smart-rf-transmitter-mobile`, `token-dispenser-mobile`, `nurse-call-receiver-mobile`): one card mounted inside the platform's own `DeviceDetailPage` via `PidDynamicPageRenderer.tsx`, exporting a `DevicePackageComponent`. These were all hand-authored directly as plain `React.createElement()` JavaScript with no build step -- workable for one embedded panel, but it doesn't scale to real authoring (no JSX, no type-checking, easy to drift from the platform's actual React/type versions).

**Full routed product package** (`smart-streamer-plugin`, `qrunlock-mobile`): a whole mounted sub-app with its own internal navigation, reached via `RemoteProductMount.tsx` and exporting a `RemoteProductPackageComponent`. `qrunlock-mobile` is the reference implementation for how these should be built going forward:

- Real `.tsx` source, authored and type-checked like any other platform code -- see `PWA_APK/apps/web-pwa/src/features/qrunlock/remotePackage/`.
- A dedicated Vite lib-mode config (`.../remotePackage/vite.config.ts`) built on the shared factory `PWA_APK/apps/web-pwa/src/platform/remotePackageBuild/createRemotePackageConfig.ts`, compiling that source to a single self-registering `remoteEntry.js` IIFE.
- `react` and `react-router-dom` are aliased at build time (`platform/remotePackageBuild/reactHostShim.ts`, `reactRouterDomHostShim.ts`) to read off `window.__JENIX_DEVICE_PACKAGE_HOST__` instead of bundling their own copies -- required for hooks and nested `<Routes>` to work against the host app's single React/router instance. `devicePackageRegistry.ts` exposes both `React` and `ReactRouterDOM` on that host object for exactly this purpose.
- CSS ships via the same script tag: the entry imports its stylesheet with Vite's `?inline` query and injects a `<style>` tag itself, since `devicePackageRegistry.ts`'s loader only ever inserts a `<script>`, never a `<link>`.
- Run with `pnpm --filter @jenix/web-pwa build:qrunlock-package`; a new package following this pattern adds its own `vite.config.ts` calling `createRemotePackageConfig()` and its own npm script.

New product-level packages should follow the `qrunlock-mobile` pattern, not the older hand-written dynamic-page one. The dynamic-page packages are not on a forced migration path, but if one grows past "a single embedded panel," moving it to this build is the recommended direction.

Three real bugs only surfaced testing `qrunlock-mobile` on an actual phone (a hosted-PWA-only test wouldn't have caught any of them, since the hosted PWA is same-origin and the dev/prod React split behaves differently in a normal app build) -- all three are now handled by `createRemotePackageConfig`/`apiOrigin.ts` automatically, so a new package built the same way gets the fix for free, but it's worth knowing they exist if a package build ever behaves oddly only on-device: an unreplaced `process.env.NODE_ENV` reference (no `process` global in a browser), the real `react/jsx-runtime`'s dependency on React's internal shape (fixed by aliasing it to its own shim, not just aliasing `react`), and `apiOrigin` needing runtime detection instead of a build-time env var (a remote package is one artifact shared by the hosted PWA and the native app, so it can't bake in a fixed target the way the main app's own `build`/`build:capacitor` split does).

### Authoring copy of package artifacts

Path:
- `PWA_APK/apps/web-pwa/public/ui-packages/tank-guard-mobile/1.0.0/*`

Purpose:
- local development
- local build/test
- canonical platform authoring copy for the current Tank Guard package

### Published PID artifact copy

Repo:
- `IOT_Devices`

Path:
- `devices/JNX-TG-C3-001/ui-packages/tank-guard-mobile/1.0.0/*`

Purpose:
- published package artifact
- VPS `device-registry` source
- clean PID-scoped ownership outside the main platform repo

## Runtime call chain

1. Device is provisioned with a PID.
2. HOME bootstrap returns:
   - device bindings
   - PID bindings
   - package records
3. User taps the device tile on `/home`.
4. Browser opens `/devices/:deviceId`.
5. Device detail resolves the remote package binding.
6. `devicePackageRegistry.ts` injects a script tag for the package entry path.
7. The remote entry registers `TankGuardDynamicPage`.
8. The page reads runtime data through:
   - `/api/v1/devices/:deviceId/ui-runtime`
9. Device commands go through:
   - `/api/v1/devices/:deviceId/commands`
10. Device acks and telemetry update the runtime view.

## VPS artifact and deployment model

### Repositories

- platform source: `https://github.com/manoj020218/iot-one`
- PID artifact source: `https://github.com/manoj020218/IOT_Devices`

### VPS locations

- platform git clone: `/root/repos/iot-one`
- device git clone: `/root/repos/IOT_Devices`
- live runtime folder: `/root/projects/IOT_one`
- live registry folder: `/root/projects/IOT_one/device-registry`
- secrets: `/root/secrets/iot-one`

### VPS scripts

- `/root/bin/deploy-iot-one.sh`
- `/root/bin/sync-device-registry.sh`

Usage:
- full runtime refresh: `bash /root/bin/deploy-iot-one.sh main`
- registry refresh only: `bash /root/bin/sync-device-registry.sh main`

### Why this deploy model was chosen

- local development remains the source of truth
- GitHub is the review and recovery point
- VPS does not become the primary editing environment
- secrets remain outside git
- device package artifacts can be published independently from the platform repo

## Why `one.jenix.in` serves `/ui-packages`

The browser loads `/ui-packages/...` from the same origin as the PWA. The PWA is served
from `one.jenix.in` (under `/app`, alongside the marketing site at the domain root — see
below), so the package alias must also live on that same origin, at the same top level.

Current nginx behavior:
- URL: `https://one.jenix.in/ui-packages/...`
- Filesystem alias: `/root/projects/IOT_one/device-registry/ui-packages/...`

`backend.jenix.in` was intentionally left untouched because it already serves a different site and is not the right browser origin for the remote package scripts.

### Update: the PWA now lives at `/app`, not the domain root

The marketing site (`Marekting/`) was later deployed to `one.jenix.in`'s domain root,
which silently displaced the PWA that used to live there. Rather than move the PWA to a
new root domain (e.g. `app.iotsoft.in`), it now lives at `https://one.jenix.in/app`
instead — same domain the Google OAuth client is already approved for, so buyers signing
in with Google keep working with zero changes needed in Google Cloud Console (origin
checks are scheme+host only, no path, and `one.jenix.in` was already authorized). See
`VPS/nginx/one.jenix.in.conf` for the full config: the marketing site's build goes to
`/var/www/one.jenix.in/`, the PWA's build (built with `base: "/app/"` in
`PWA_APK/apps/web-pwa/vite.config.ts`) goes to `/var/www/one.jenix.in/app/`, and nginx
checks `/app/` before falling through to the marketing site's own SPA catch-all.

## What is complete

- PID UI profile fields: `uiMode`, `uiPackageId`, `uiPackageVersion`
- HOME bootstrap package response
- device runtime and command APIs
- direct `/home` -> `/devices/:deviceId` flow
- runtime remote package loader
- published Tank Guard package artifact
- `IOT_Devices` PID-first repo structure
- VPS device-registry sync script
- nginx alias serving `/ui-packages` from `device-registry`

## What is still manual

- copying authoring package changes into `IOT_Devices`
- bumping package versions and catalog entries
- package signing/integrity management
- fully automated publish pipeline

## If you change something

### Add a new device type

1. Create a new PID package under `IOT_Devices/devices/<PID>/`
2. Add a package record in the platform package catalog
3. Add or update PID schema defaults
4. Publish UI artifacts and firmware release metadata
5. Run `deploy-iot-one.sh` or `sync-device-registry.sh`

### Change Tank Guard page behavior

1. Update the local authoring copy in:
   - `PWA_APK/apps/web-pwa/public/ui-packages/tank-guard-mobile/1.0.0/*`
2. Keep the runtime support code aligned:
   - `PWA_APK/apps/web-pwa/src/features/devices/plugins/*`
3. Copy the published package artifact into:
   - `IOT_Devices/devices/JNX-TG-C3-001/ui-packages/tank-guard-mobile/1.0.0/*`
4. Sync the VPS registry

### Change PID routing or package selection

Update:
- `packages/device-schemas/src/pid/pid.types.ts`
- `VPS/apps/api-server/src/modules/ui-packages/ui-package.catalog.ts`
- `VPS/apps/api-server/src/modules/homes/home.service.ts`

## Known limitations

- package catalog is still hardcoded in the API server
- no CI publish step from platform authoring copy to `IOT_Devices`
- no package signing or integrity enforcement yet
- no rollback script beyond git checkout + registry resync

## Recommended next steps

1. Add package integrity hashes and verify them before execution.
2. Move package catalog resolution from static code to registry-backed metadata.
3. Add a single publish script that updates:
   - platform authoring copy
   - `IOT_Devices`
   - VPS `device-registry`
4. Add service restart wrappers if API/PWA runtime processes are formalized on the VPS.
