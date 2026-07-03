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

- Auth sessions now use signed bearer access tokens on user-facing routes, and auth users plus refresh sessions can persist in MongoDB with `AUTH_PERSISTENCE_MODE=mongodb`.
- The PWA now prefers the live `/api/v1/auth/*` contract and keeps the authenticated session in local storage so bearer auth survives reloads.
- The API server now starts an in-process scene scheduler by default.
- Scene persistence defaults to MongoDB when `MONGODB_URI` is set, or can be forced with `SCENE_PERSISTENCE_MODE=mongodb`.
- HOME, provisioning, OTA, and API access persistence also default to MongoDB when `MONGODB_URI` is set, and can be forced with `HOME_PERSISTENCE_MODE`, `PROVISIONING_PERSISTENCE_MODE`, `OTA_PERSISTENCE_MODE`, and `API_ACCESS_PERSISTENCE_MODE`.
- Auth user records persist in `auth_users`, and refresh sessions persist in `auth_refresh_sessions` when the auth MongoDB driver is enabled.
- Scene records, scene audit logs, and scene run history now persist in MongoDB collections `scenes`, `scene_audit_logs`, and `scene_run_history`.
- Matched scene actions now enqueue into `scene_action_dispatch_jobs`, and the API process starts a scene action worker by default to drain that queue behind a worker boundary.
- HOME data now persists in MongoDB collections `homes`, `home_members`, `home_share_codes`, `home_user_profiles`, and `home_audit_logs` when the HOME driver is enabled.
- Provisioning intents persist in `provisioning_intents`, OTA releases persist in `ota_releases`, and API packages/keys/secrets persist in `api_packages`, `api_keys`, and `api_key_secrets` when their MongoDB drivers are enabled.
- Scheduler control comes from `SCENE_SCHEDULER_ENABLED` and `SCENE_SCHEDULER_INTERVAL_MS`.
- Scene action worker control comes from `SCENE_ACTION_WORKER_ENABLED`, `SCENE_ACTION_WORKER_INTERVAL_MS`, `SCENE_ACTION_WORKER_BATCH_SIZE`, and `SCENE_ACTION_WORKER_VISIBILITY_TIMEOUT_MS`.
- Scheduler leadership can be coordinated across multiple API instances with `SCENE_SCHEDULER_COORDINATION_MODE=mongodb-lock`, `SCENE_SCHEDULER_LEASE_MS`, and an optional `SCENE_SCHEDULER_INSTANCE_ID`.
- Device telemetry can be ingested through `POST /api/v1/devices/:deviceId/telemetry`, which updates device liveness and evaluates matching device-threshold scenes immediately.
- Mongo lease coordination prevents duplicate scheduler ownership across instances, and action delivery is now isolated behind a claimed-job worker, but telemetry ingestion and schedule evaluation still run inside the API service.
- PID persistence now supports `PID_PERSISTENCE_MODE=memory|mongodb` and device persistence now supports `DEVICE_PERSISTENCE_MODE=memory|mongodb`. Both default to MongoDB when `MONGODB_URI` is set.
- PID records and PID audit logs now persist in MongoDB collections `product_pids` and `pid_audit_logs`, and device records persist in the `devices` collection when the MongoDB drivers are enabled.
- HOME-scoped device, scene, Matter, and API key permissions no longer trust `x-home-role`; the backend now resolves HOME membership from persisted sharing data.
- Device firmware planning is available through `GET /api/v1/devices/:deviceId/firmware-plan`, and firmware requests now resolve against published OTA releases by PID and hardware revision before returning a queued intent.
- OTA releases are managed through developer routes under `/api/v1/admin/ota/releases`.
- Third-party API packages are managed through `/api/v1/admin/api-packages`, HOME-scoped API keys through `/api/v1/api-keys`, and public device access through `/api/v1/public/devices/:deviceId/...` with API-key scope enforcement.
- Matter readiness is exposed through `GET /api/v1/matter/devices/:deviceId/status`, with owner/admin placeholder actions at `POST /api/v1/matter/devices/:deviceId/commission` and `POST /api/v1/matter/devices/:deviceId/bridge-sync`.
- Matter commissioning and bridge sync are still modeled placeholders; they validate PID/device readiness and permissions now, but live commissioner and gateway transport are not wired yet.
- Matter runtime is disabled by default with `MATTER_RUNTIME_ENABLED=false` and should remain off until vendor ID, CSA readiness, and the broader multi-product rollout are ready.
