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
- Scene persistence defaults to MongoDB when `MONGODB_URI` is set, or can be forced with `SCENE_PERSISTENCE_MODE=mongodb`.
- Scene records, scene audit logs, and scene run history now persist in MongoDB collections `scenes`, `scene_audit_logs`, and `scene_run_history`.
- Scheduler control comes from `SCENE_SCHEDULER_ENABLED` and `SCENE_SCHEDULER_INTERVAL_MS`.
- Scheduler leadership can be coordinated across multiple API instances with `SCENE_SCHEDULER_COORDINATION_MODE=mongodb-lock`, `SCENE_SCHEDULER_LEASE_MS`, and an optional `SCENE_SCHEDULER_INSTANCE_ID`.
- Device telemetry can be ingested through `POST /api/v1/devices/:deviceId/telemetry`, which updates device liveness and evaluates matching device-threshold scenes immediately.
- Mongo lease coordination prevents duplicate scheduler ownership across instances, but transport-side scale still benefits from a dedicated worker or queue-backed runtime when deployment complexity grows.
- Device firmware planning is available through `GET /api/v1/devices/:deviceId/firmware-plan`, and firmware requests now resolve against published OTA releases by PID and hardware revision before returning a queued intent.
- OTA releases are managed through developer routes under `/api/v1/admin/ota/releases`.
- Third-party API packages are managed through `/api/v1/admin/api-packages`, HOME-scoped API keys through `/api/v1/api-keys`, and public device access through `/api/v1/public/devices/:deviceId/...` with API-key scope enforcement.
- Matter readiness is exposed through `GET /api/v1/matter/devices/:deviceId/status`, with owner/admin placeholder actions at `POST /api/v1/matter/devices/:deviceId/commission` and `POST /api/v1/matter/devices/:deviceId/bridge-sync`.
- Matter commissioning and bridge sync are still modeled placeholders; they validate PID/device readiness and permissions now, but live commissioner and gateway transport are not wired yet.
- Matter runtime is disabled by default with `MATTER_RUNTIME_ENABLED=false` and should remain off until vendor ID, CSA readiness, and the broader multi-product rollout are ready.
