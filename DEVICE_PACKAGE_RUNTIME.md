# Jenix One Device Package Runtime

This document explains why the dynamic device-package runtime was added, how it currently works, and what a new developer should touch next.

## Goal

Jenix One should stay a thin platform shell while device-specific pages are loaded only when a HOME actually owns that device type.

Current example:
- PID: `JNX-TG-C3-001`
- package: `tank-guard-mobile@1.0.0`

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

The browser loads `/ui-packages/...` from the same origin as the PWA. Because the PWA is served from `one.jenix.in`, the package alias must also live there.

Current nginx behavior:
- URL: `https://one.jenix.in/ui-packages/...`
- Filesystem alias: `/root/projects/IOT_one/device-registry/ui-packages/...`

`backend.jenix.in` was intentionally left untouched because it already serves a different site and is not the right browser origin for the remote package scripts.

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
