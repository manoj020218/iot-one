# Jenix IoT Platform

Jenix IoT Platform is a PNPM monorepo for the Jenix One PWA, Android APK shell, VPS-side API services, and shared PID-driven platform packages.

## Workspace Layout

```text
jenix One/
  VPS/
    apps/
      api-server/
      admin-backend-ui/
  PWA_APK/
    apps/
      web-pwa/
      android/
  packages/
    shared/
    ui/
    device-schemas/
  IOT_Device/
```

## Principles

- PID-first architecture across platform, firmware, OTA, Matter, and API scopes
- Small modular features instead of large files
- Shared contracts in workspace packages
- Tests, typecheck, and build as phase exit requirements

## Commands

Use `cmd /c pnpm <command>` on this machine if PowerShell blocks the `pnpm.ps1` shim.

```bash
cmd /c pnpm install
cmd /c pnpm lint
cmd /c pnpm typecheck
cmd /c pnpm test
cmd /c pnpm build
```

## Runtime Notes

- The API server now starts an in-process scene scheduler by default.
- Scheduler control comes from `SCENE_SCHEDULER_ENABLED` and `SCENE_SCHEDULER_INTERVAL_MS`.
- Device telemetry can be ingested through `POST /api/v1/devices/:deviceId/telemetry`, which updates device liveness and evaluates matching device-threshold scenes immediately.
