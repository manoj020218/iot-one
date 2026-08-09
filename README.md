# Jenix IoT Platform

Jenix IoT Platform is a PNPM monorepo for the Jenix One PWA, Android APK shell, VPS-side API services, and shared PID-driven platform packages.

## Integration Guide

- **New to this repo? Start with [HANDOFF.md](./HANDOFF.md)** — current state, VPS deploy gotchas, known open items.
- Device developer handoff: [DEVICE_INTEGRATION_GUIDE.md](./DEVICE_INTEGRATION_GUIDE.md)
- Dynamic package runtime and VPS deployment flow: [DEVICE_PACKAGE_RUNTIME.md](./DEVICE_PACKAGE_RUNTIME.md)
- Licensed MQTT and third-party device access architecture plan: [MQTT_LICENSED_DEVICE_ACCESS_PLAN.md](./MQTT_LICENSED_DEVICE_ACCESS_PLAN.md)

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
- The PWA now prefers the live `/api/v1/auth/*` contract, keeps the authenticated session in local storage, and automatically rotates refreshable bearer sessions before access-token expiry.
- The API server now starts an in-process scene scheduler by default.
- MQTT-backed runtime ingress and delivery can be enabled with `MQTT_RUNTIME_ENABLED=true`. When enabled, telemetry ingress and scheduler ticks publish MQTT envelopes first, and the API server subscribes to MQTT telemetry/schedule topics before enqueuing runtime evaluation work.
- Scene persistence defaults to MongoDB when `MONGODB_URI` is set, or can be forced with `SCENE_PERSISTENCE_MODE=mongodb`.
- HOME, provisioning, OTA, and API access persistence also default to MongoDB when `MONGODB_URI` is set, and can be forced with `HOME_PERSISTENCE_MODE`, `PROVISIONING_PERSISTENCE_MODE`, `OTA_PERSISTENCE_MODE`, and `API_ACCESS_PERSISTENCE_MODE`.
- Auth user records persist in `auth_users`, and refresh sessions persist in `auth_refresh_sessions` when the auth MongoDB driver is enabled.
- Scene records, scene audit logs, and scene run history now persist in MongoDB collections `scenes`, `scene_audit_logs`, and `scene_run_history`.
- Telemetry-triggered and scheduled scene evaluation jobs now persist in `scene_evaluation_jobs`.
- Matched scene actions now enqueue into `scene_action_dispatch_jobs`, and the API process starts a scene action worker by default to drain that queue behind a worker boundary.
- HOME data now persists in MongoDB collections `homes`, `home_members`, `home_share_codes`, `home_user_profiles`, and `home_audit_logs` when the HOME driver is enabled.
- Provisioning intents persist in `provisioning_intents`, OTA releases persist in `ota_releases`, and API packages/keys/secrets persist in `api_packages`, `api_keys`, and `api_key_secrets` when their MongoDB drivers are enabled.
- OTA delivery jobs now persist in `ota_delivery_jobs` when the OTA MongoDB driver is enabled.
- Scheduler control comes from `SCENE_SCHEDULER_ENABLED` and `SCENE_SCHEDULER_INTERVAL_MS`.
- Scene runtime worker control comes from `SCENE_RUNTIME_WORKER_ENABLED`, `SCENE_RUNTIME_WORKER_INTERVAL_MS`, `SCENE_RUNTIME_WORKER_BATCH_SIZE`, and `SCENE_RUNTIME_WORKER_VISIBILITY_TIMEOUT_MS`.
- Scene action worker control comes from `SCENE_ACTION_WORKER_ENABLED`, `SCENE_ACTION_WORKER_INTERVAL_MS`, `SCENE_ACTION_WORKER_BATCH_SIZE`, and `SCENE_ACTION_WORKER_VISIBILITY_TIMEOUT_MS`.
- OTA delivery worker control comes from `OTA_DELIVERY_WORKER_ENABLED`, `OTA_DELIVERY_WORKER_INTERVAL_MS`, `OTA_DELIVERY_WORKER_BATCH_SIZE`, and `OTA_DELIVERY_WORKER_VISIBILITY_TIMEOUT_MS`.
- MQTT runtime topics are configured with `MQTT_TELEMETRY_TOPIC`, `MQTT_SCHEDULE_TOPIC`, `MQTT_DEVICE_COMMAND_TOPIC`, `MQTT_DEVICE_COMMAND_ACK_TOPIC`, `MQTT_NOTIFICATION_TOPIC`, `MQTT_OTA_REQUEST_TOPIC`, and `MQTT_OTA_ACK_TOPIC`.
- Scheduler leadership can be coordinated across multiple API instances with `SCENE_SCHEDULER_COORDINATION_MODE=mongodb-lock`, `SCENE_SCHEDULER_LEASE_MS`, and an optional `SCENE_SCHEDULER_INSTANCE_ID`.
- Device telemetry can still be ingested through `POST /api/v1/devices/:deviceId/telemetry`, but when MQTT runtime is enabled that route now publishes the same telemetry envelope to MQTT so HTTP remains a fallback instead of the only runtime source.
- Mongo lease coordination prevents duplicate scheduler ownership across instances, scheduler ticks now publish MQTT schedule envelopes when enabled, runtime evaluation is isolated behind claimed-job workers, and scene actions plus firmware requests can publish real MQTT device-delivery messages.
- Scene action dispatch jobs now stay in `dispatched` state until the device returns an MQTT acknowledgement or the worker lease expires and the command becomes retryable again.
- Firmware requests no longer publish OTA payloads directly from the request path; they now queue durable OTA delivery jobs that a dedicated worker publishes and retries until acknowledgement or failure.
- Device firmware rollout history is now exposed at `GET /api/v1/devices/:deviceId/firmware/rollouts`, with failed-job replay available at `POST /api/v1/devices/:deviceId/firmware/rollouts/:requestId/replay`.
- Scene dispatch history is now exposed at `GET /api/v1/scenes/:sceneId/dispatches`, with failed-job replay available at `POST /api/v1/scenes/:sceneId/dispatches/:jobId/replay`.
- The PWA device detail page now shows rollout acknowledgement state, last delivery error, and a replay action for failed firmware jobs.
- PID persistence now supports `PID_PERSISTENCE_MODE=memory|mongodb` and device persistence now supports `DEVICE_PERSISTENCE_MODE=memory|mongodb`. Both default to MongoDB when `MONGODB_URI` is set.
- PID records and PID audit logs now persist in MongoDB collections `product_pids` and `pid_audit_logs`, and device records persist in the `devices` collection when the MongoDB drivers are enabled.
- The device UI package catalog is now registry-backed instead of a hardcoded source map: `UI_PACKAGE_PERSISTENCE_MODE=memory|mongodb` (defaults to MongoDB when `MONGODB_URI` is set) persists packages in `ui_packages` and their audit trail in `ui_package_audit_logs`. Adding a new device's remote UI package is now a `POST /api/v1/admin/ui-packages` call (gated by `x-admin-key` + `x-role: JENIX_DEVELOPER`, same as PID/OTA admin routes), not a code change — see the Package Registry screen in `admin-backend-ui`. Packages are versioned (draft/published/deprecated) with publish and rollback endpoints under `/api/v1/admin/ui-packages/:packageId/...`.
- HOME-scoped device, scene, Matter, and API key permissions no longer trust `x-home-role`; the backend now resolves HOME membership from persisted sharing data.
- Device firmware planning is available through `GET /api/v1/devices/:deviceId/firmware-plan`, and firmware requests now resolve against published OTA releases by PID and hardware revision before returning a queued intent.
- OTA releases are managed through developer routes under `/api/v1/admin/ota/releases`.
- Third-party API packages are managed through `/api/v1/admin/api-packages`, HOME-scoped API keys through `/api/v1/api-keys`, and public device access through `/api/v1/public/devices/:deviceId/...` with API-key scope enforcement.
- Matter readiness is exposed through `GET /api/v1/matter/devices/:deviceId/status`, with owner/admin placeholder actions at `POST /api/v1/matter/devices/:deviceId/commission` and `POST /api/v1/matter/devices/:deviceId/bridge-sync`.
- Matter commissioning and bridge sync are still modeled placeholders; they validate PID/device readiness and permissions now, but live commissioner and gateway transport are not wired yet.
- Matter runtime is disabled by default with `MATTER_RUNTIME_ENABLED=false` and should remain off until vendor ID, CSA readiness, and the broader multi-product rollout are ready.
- Device MQTT topics are now frozen to one canonical scheme for every device, past and future: `jnx/{tenantId}/{pid}/{deviceId}/{suffix}` (suffixes: `telemetry`, `status`, `events`, `cmd`, `cmd/ack`, `ota`, `ota/ack`, `lwt`). Build/parse it via `buildDeviceTopic`/`buildDeviceTopicWildcard`/`parseDeviceTopic` in `@jenix/shared` — never hand-concatenate a device topic string. `tenantId` defaults to the device's `homeId` today; it exists as its own field so a future vendor/OEM tenant can populate it later without reshaping the topic. Only the scheduler-tick and notification topics remain flat/internal (`MQTT_SCHEDULE_TOPIC`, `MQTT_NOTIFICATION_TOPIC`); the old `MQTT_TELEMETRY_TOPIC`/`MQTT_DEVICE_COMMAND_TOPIC`/`MQTT_DEVICE_COMMAND_ACK_TOPIC`/`MQTT_OTA_REQUEST_TOPIC`/`MQTT_OTA_ACK_TOPIC` env vars are gone — those topics are now computed, not configured. See `MQTT_LICENSED_DEVICE_ACCESS_PLAN.md` for the security model this scheme is designed to carry (per-device credentials, signed license manifests, broker ACLs) once those phases are built.
- The first event-driven (non-numeric-telemetry) device, the Jenix Nurse Call Receiver (`JNX-RFNC-C3-01`), is wired up in `VPS/apps/api-server/src/modules/nurse-call-receiver/`: remotes and active/attended calls persist per device, and MQTT `events`/`status` messages route in through `handleRuntimeDeviceEventsMessage`/`handleRuntimeDeviceStatusMessage` in `infrastructure/mqtt/runtime.handlers.ts`, keyed by PID. `NURSE_CALL_RECEIVER_PERSISTENCE_MODE=memory|mongodb` controls its persistence the same way as every other module.
- The Smart RF Transmitter (`JNX-SRR433-C3-STX01`) is the first device whose already-flashed firmware speaks its own MQTT contract (`JENIXONE_MQTT_HANDOFF.md`'s `{topicRoot}/{deviceId}/{suffix}` shape with per-action `cmd/*` sub-topics) rather than the canonical scheme. Instead of reflashing it, the MQTT bridge now carries a small legacy adapter: `legacyTopicRoots`/`onLegacyDeviceMessage` on `MqttRuntimeBridgeOptions`, `buildLegacyDeviceTopic`/`buildLegacyCommandTopic`/`parseLegacyDeviceTopic` in `@jenix/shared`, and `bridge.publishLegacyDeviceCommand(...)` for outbound per-action commands. `VPS/apps/api-server/src/modules/smart-rf-transmitter/` persists RF button profiles and a command log, and `SMART_RF_TRANSMITTER_PERSISTENCE_MODE=memory|mongodb` controls it the same way as every other module.
- Token Dispenser (`JNX-TD-C3-01`) turned out to speak a *third*, different real contract (`jenix/{tenantId}/{siteId}/{deviceId}/{telemetry|state|command|event}`, confirmed straight from its `mqtt_client.cpp` — the `JENIXONE_MQTT_HANDOFF.md` handoff note for this device was aspirational, not what actually shipped). Since `tenantId`/`siteId` vary per device rather than being one fixed family root, it doesn't fit the Transmitter's `legacyTopicRoots` adapter either, so the bridge gained a second, more general escape hatch: `rawSubscriptions`/`onRawMessage`/`publishRaw` on `MqttRuntimeBridgeOptions`/`RuntimeMqttBridge`, which hand the raw topic string to the caller instead of trying to parse it in the bridge. `VPS/apps/api-server/src/modules/token-dispenser/` does its own topic parsing (`handleRuntimeRawMessage` in `runtime.handlers.ts`) and persists print templates, per-device MQTT tenant/site labels, and a command log; `TOKEN_DISPENSER_PERSISTENCE_MODE=memory|mongodb` controls it the same way as every other module.
- P10 Token Display (`JNX-P10-C3-01`) — the visual+audio half of a queue system paired with the Token Dispenser — speaks a *fourth* real contract, `jenix/v1/{homeId}/{deviceId}/{telemetry|state|command|command/ack}` (confirmed against its `mqtt_client.cpp`; unlike Token Dispenser's arbitrary tenant/site labels, this `homeId` is literally the platform's own). It reuses the same raw-passthrough escape hatch, but since both shapes are 5-segment `jenix/...` topics, `handleRuntimeRawMessage` must check the P10 pattern (which requires a literal `"v1"` second segment) *before* Token Dispenser's wildcard pattern, or a Token Dispenser device with tenant label `"v1"` would collide with it — caught by `p10-display.test.ts`, not by inspection. `VPS/apps/api-server/src/modules/p10-display/` persists a command log; `P10_DISPLAY_PERSISTENCE_MODE=memory|mongodb` controls it the same way as every other module.
- Smart SOS Siren (`JNX-SOS-C3-001`) is the first device this session with **no existing real MQTT contract at all** to reconcile — its `MqttClientService.cpp` is a complete no-op stub (`ENABLE_MQTT=0`). With nothing to preserve, it goes straight onto the canonical scheme with zero new bridge code: outbound commands already work generically via `bridge.publishDeviceCommand`, and inbound `status` now dispatches by PID through a small map in `handleRuntimeDeviceStatusMessage` (the same generalize-on-second-caller pattern used for `legacyTopicRootHandlers`, since the Nurse Call Receiver was the first canonical-scheme device). Two new `SceneActionCommand` entries, `trigger_alarm`/`stop_alarm` (intentionally unrestricted, so an automated flood/fire/landslide scene can fire it), let large-area warning automations dispatch straight to this device; everything else reuses `apply_settings`/`alarm_test`/`restart`/`factory_reset`. `VPS/apps/api-server/src/modules/sos-siren/` persists a command log; `SOS_SIREN_PERSISTENCE_MODE=memory|mongodb` controls it the same way as every other module. See `IOT_Device/Loud SOS Siren/pwa tool/INTEGRATION.md` for what's real (the whole platform side) versus what's still a defined target (the firmware's MQTT client).
