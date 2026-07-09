# Jenix Device Integration Guide

This file is the device-developer handoff for onboarding a new product into Jenix One.

Goal: a firmware, hardware, or device-integration developer should be able to use this one guide to make a new device work with provisioning, registration, MQTT, scenes, HOME sharing, OTA, and the PWA surface without reading the whole platform codebase.

---

## TL;DR — Add a device by touching only these files

You do **not** need to read the whole codebase. A new device type is added by touching the files below. Everything else (routing, auth, scene runtime, OTA delivery) is generic and already works.

| Step | What | File(s) to edit / call | Section |
|---|---|---|---|
| 1 | Define the product (PID) | Create via `POST /api/v1/admin/pids` (needs `x-admin-key` — see **Admin auth**). Blueprint shape: `packages/device-schemas/src/pid/pid.types.ts` | [Required Product Metadata: PID](#required-product-metadata-pid) |
| 2 | Declare telemetry fields | `packages/device-schemas/src/telemetry/telemetry.types.ts` — add `TelemetryFieldDefinition`s (e.g. `tankLevelMm`) | [Telemetry Contract](#telemetry-contract) |
| 3 | Firmware auth | Send header `x-device-key: <DEVICE_INGEST_KEY>` on every telemetry POST | [Device authentication (required)](#device-authentication-required) |
| 4 | Provision + register | `POST /api/v1/provisioning/*` then `POST /api/v1/devices/register` | [Provisioning Contract](#provisioning-contract) |
| 5 | Show it on the dashboard | `PWA_APK/apps/web-pwa/src/features/home/telemetry/deviceTelemetry.ts` — map telemetry → gauge metrics | [Dashboard UI integration](#dashboard-ui-integration) |

If your device reports a tank level and a signal strength, **steps 1, 2 and 4 are all you need** — the dashboard already renders a tank gauge, signal bars, sparkline, and pump control from the shared telemetry shape.

## Device authentication (required)

Two shared secrets protect the platform. Device/firmware developers only need the first.

- **`x-device-key`** (SEC-02): every `POST /api/v1/devices/:deviceId/telemetry` (and `/register`) must send `x-device-key: <DEVICE_INGEST_KEY>`. Without it the request is rejected (`401`) in production. The value is the `DEVICE_INGEST_KEY` from the server `.env`. *Roadmap:* move to a per-device secret/HMAC — the header name and call site stay the same.
- **`x-admin-key`** (SEC-01, tooling only): admin/OTA/PID endpoints under `/api/v1/admin/*` require `x-admin-key: <ADMIN_API_KEY>` in addition to the existing `x-role: JENIX_DEVELOPER` header. Firmware never calls these; only the admin console / release tooling does.

Both gates fail **open** in development/test (no key configured) and **closed** in production, so local integration work needs no setup. See `VPS/apps/api-server/src/infrastructure/http/require-device-auth.ts` and `require-admin.ts`.

## Dashboard UI integration

The mobile-first PWA dashboard (`PWA_APK/apps/web-pwa/src/features/home/`) is schema-driven and needs **no per-device UI code** for a standard sensor device. It renders every device from one telemetry shape (`DeviceMetrics`).

- **Single touch point:** `features/home/telemetry/deviceTelemetry.ts` — replace/extend `deriveBaseMetrics()` to map your real telemetry payload into `DeviceMetrics` (`levelPct`, `tankMm`, `rssi`, `flow`, `temp`, `batt`, `pump`, `alert`, `history`). The tile, gauge, sparkline, signal bars and the device console all read from this.
- **Components you get for free:** `TankGauge`, `Sparkline`, `SignalBars`, `StatusChip`, `DeviceTile`, `DeviceDrawer`, `AddDeviceSheet`, `MobileNav` — each < 200 lines, all icons via `react-icons` (Capacitor/APK friendly).
- **Add-device UX:** `features/home/components/AddDeviceSheet.tsx` is the Tuya-style scan → pick → name → done flow; wire its `DISCOVERED` list to your BLE/AP provisioning results (same shape).
- **Theme:** `features/home/theme/home.css` (scoped under `.jx`) — reuse the CSS variables for any new panel so it matches automatically.

If a device is **not** tank-shaped, add a new gauge component next to `TankGauge.tsx` and branch on `pid`/telemetry in `DeviceTile.tsx` — that is the only place device-type-specific UI belongs.

---

## What Every New Device Must Support

Every onboarded device must align to these platform rules:

1. The product must have a PID created first. Jenix is PID-first.
2. The device must have one stable `deviceId` for its lifetime.
3. The device must know its `pid`.
4. The device should report its `firmwareVersion`.
5. The device should report or match the correct `hardwareRevision`.
6. The device must support at least one provisioning path: `ble` or `ap`.
7. The device must be able to send telemetry to the VPS.
8. If scenes should control the device, it must consume MQTT scene-command messages and publish MQTT acknowledgements.
9. If OTA should work, it must consume MQTT OTA request messages and publish MQTT acknowledgements.

## One-Line Integration Flow

1. Create PID
2. Publish OTA release for that PID and hardware revision
3. Add provisioning support in the device
4. Register the device in Jenix after provisioning
5. Send telemetry
6. Receive MQTT scene commands and ack them
7. Receive MQTT OTA jobs and ack them
8. Validate device detail, scene behavior, sharing behavior, and firmware rollout

## Non-Negotiable Platform Rules

- PID must be created before device registration.
- PID is the root identity for UI, telemetry meaning, OTA matching, Matter mode, and API packaging.
- OTA is always resolved by `pid` plus `hardwareRevision`.
- HOME membership controls user access. Devices belong to one `homeId`.
- Scenes use device telemetry plus MQTT command delivery.
- Sharing changes who can operate the device. It does not change the device contract.

## Required Product Metadata: PID

Before a device can be onboarded correctly, create a PID through:

- Admin API: `/api/v1/admin/pids`
- Public read API: `/api/v1/pids/:pid`

The PID payload must include:

- Identity
  - `pid`
  - `productName`
  - `productCategory`
  - `productLine`
  - `status`
  - `matterMode`
  - `brand` must be `JENIX`
- Hardware profile
  - `mcu`
  - `hardwareRevision`
  - transport capabilities like `hasBle`, `hasWifi`, `hasMatter`, `hasThread`, `hasEthernet`, `hasRs485`
- Firmware profile
  - `firmwareFamily`
  - `otaChannel`
  - `stableVersion` before approval
  - `rollbackAllowed`
- Matter profile
  - `enabled`
  - `mode`
  - `bridgeSupported`
- API profile
  - `enabled`
  - `sellable`
  - `allowedScopes`
- Dashboard profile
  - `templateId`
  - `dynamicPages`
  - optional `icon`
  - optional `cardLayout`
- Optional product art
  - `iconUrl`
  - `imageUrl`

### PID Example

```json
{
  "pid": "JNX-TG-C3-201",
  "productName": "Smart Tank Guard Pro",
  "productCategory": "Water Monitoring",
  "productLine": "Tank Guard",
  "status": "beta",
  "matterMode": "NONE",
  "brand": "JENIX",
  "description": "Tank monitoring device with Wi-Fi and BLE provisioning.",
  "iconUrl": "https://cdn.example.com/jenix/tank-guard-pro/icon.png",
  "imageUrl": "https://cdn.example.com/jenix/tank-guard-pro/hero.png",
  "hardware": {
    "mcu": "ESP32-C3",
    "hardwareRevision": "HW1.0",
    "hasRs485": false,
    "hasBle": true,
    "hasWifi": true,
    "hasMatter": false,
    "hasThread": false,
    "hasEthernet": false
  },
  "firmware": {
    "firmwareFamily": "tank-guard-pro",
    "otaChannel": "stable",
    "stableVersion": "1.0.0",
    "betaVersion": "1.1.0-beta.1",
    "rollbackAllowed": true
  },
  "matter": {
    "enabled": false,
    "mode": "NONE",
    "certificationStatus": "not_required",
    "bridgeSupported": false
  },
  "api": {
    "enabled": false,
    "sellable": false,
    "allowedScopes": []
  },
  "dashboard": {
    "templateId": "tank-guard-pro-default",
    "dynamicPages": ["tank-level", "thresholds"],
    "icon": "tank",
    "cardLayout": "default"
  }
}
```

## Device Identity Rules

### `pid`

- Must match an existing PID exactly.
- The backend normalizes to uppercase.

### `deviceId`

- Must be globally unique.
- The backend normalizes to uppercase.
- Never change it after manufacturing or first cloud onboarding.
- Recommended format: `JNX-<family>-<mcu or sku>-<unique suffix>`.

### `hardwareRevision`

- Should match the hardware revision used in PID and OTA release records.
- OTA release selection depends on this.

### `firmwareVersion`

- Should always be available in the device.
- Needed for proper OTA planning and rollout state.

## Provisioning Contract

The platform supports two provisioning methods:

- `ble`
- `ap`

Provisioning APIs:

- `POST /api/v1/provisioning/register-intent`
- `POST /api/v1/provisioning/:provisioningId/complete`
- `GET /api/v1/provisioning/status/:provisioningId`

Authenticated provisioning routes require:

- `Authorization: Bearer <access-token>`
- `x-home-id: <home-id>`

### Register Provisioning Intent

Request:

```json
{
  "method": "ble",
  "pid": "JNX-TG-C3-201"
}
```

Response data shape:

```json
{
  "provisioningId": "prov-...",
  "userId": "user-...",
  "homeId": "home-...",
  "method": "ble",
  "status": "BLE_CONNECTED",
  "pid": "JNX-TG-C3-201",
  "createdAt": "2026-07-07T00:00:00.000Z",
  "updatedAt": "2026-07-07T00:00:00.000Z"
}
```

### Provisioning Status Sequence

BLE flow:

- `BLE_CONNECTED`
- `WIFI_SENT`
- `DEVICE_CONNECTING_WIFI`
- `DEVICE_CONNECTING_CLOUD`
- `MQTT_CONNECTED`
- `DEVICE_REGISTERED`
- `SUCCESS`

AP flow:

- `WIFI_SENT`
- `DEVICE_CONNECTING_WIFI`
- `DEVICE_CONNECTING_CLOUD`
- `MQTT_CONNECTED`
- `DEVICE_REGISTERED`
- `SUCCESS`

### What the Device Must Do During Provisioning

- Advertise or expose enough identity for onboarding:
  - `deviceId`
  - `pid`
  - product name or recognizable name
- Accept Wi-Fi credentials from the provisioning surface
- Connect to Wi-Fi
- Connect to cloud/VPS path
- Connect to MQTT if MQTT runtime is enabled
- Reach a state where the platform can register the device

### BLE Discovery Compatibility

The current PWA BLE scan is more likely to discover a device correctly if the firmware follows these rules:

- BLE local name should start with `JNX` when possible
- or include recognizable Jenix product text like `JENIX` or the product name
- exposing a service UUID hint containing `ff00` improves fallback discovery
- embed or derive a business device ID that can be mapped to the final `deviceId`

Recommended BLE identity example:

- local name: `JNX-TG-C3-A7F2`
- advertised product text: `JENIX Smart Tank Guard`

### Complete Provisioning

Request:

```json
{
  "deviceId": "JNX-TG-C3-A7F2",
  "pid": "JNX-TG-C3-201",
  "status": "SUCCESS"
}
```

## Device Registration Contract

Route:

- `POST /api/v1/devices/register`

This route is currently open at the router level, but the PWA uses it as part of the authenticated provisioning flow and still sends:

- `Authorization: Bearer <access-token>`
- `x-home-id: <home-id>`

Required request body:

```json
{
  "deviceId": "JNX-TG-C3-A7F2",
  "pid": "JNX-TG-C3-201",
  "homeId": "home-user-123",
  "ownerUserId": "user-owner-123",
  "displayName": "Terrace Tank",
  "firmwareVersion": "1.0.0",
  "hardwareRevision": "HW1.0",
  "matterEnabled": false
}
```

Registration rules:

- PID must already exist.
- Duplicate `deviceId` is rejected.
- If `displayName` is missing, the backend falls back to the PID product name.
- Device and PID are uppercased by the backend.

## Telemetry Contract

Route:

- `POST /api/v1/devices/:deviceId/telemetry`

Required header (SEC-02): `x-device-key: <DEVICE_INGEST_KEY>`. Requests without a valid device key are rejected with `401` in production. See [Device authentication](#device-authentication-required).

The backend accepts primitive telemetry values only:

- string
- number
- boolean

Request example:

```json
{
  "telemetry": {
    "tankLevelPct": 82,
    "tankLevelMm": 1240,
    "signalStrength": -61,
    "pumpRunning": false,
    "alarmState": "normal"
  },
  "occurredAt": "2026-07-07T11:30:00.000Z",
  "mqttStatus": "online",
  "cloudStatus": "online",
  "localStatus": "available"
}
```

What telemetry does in the platform:

- updates device last-seen state
- updates device connectivity status
- feeds scene trigger evaluation
- supports future PID dynamic-page rendering

### Telemetry Naming Guidance

Use stable telemetry keys. Scene rules and future widgets will depend on them.

Recommended approach:

- choose simple machine keys like `tankLevelPct`, `temperatureC`, `relay1State`
- do not rename keys after devices ship
- keep values primitive, not nested objects

## MQTT Contract

MQTT is the main runtime integration boundary for commands, acknowledgements, and OTA when enabled.

Relevant environment variables:

- `MQTT_URL`
- `MQTT_CLIENT_ID`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_TELEMETRY_TOPIC`
- `MQTT_SCHEDULE_TOPIC`
- `MQTT_DEVICE_COMMAND_TOPIC`
- `MQTT_DEVICE_COMMAND_ACK_TOPIC`
- `MQTT_NOTIFICATION_TOPIC`
- `MQTT_OTA_REQUEST_TOPIC`
- `MQTT_OTA_ACK_TOPIC`

Default topic names from the repo:

- telemetry: `jenix/runtime/telemetry`
- schedule: `jenix/runtime/schedule`
- commands: `jenix/runtime/commands`
- command ack: `jenix/runtime/commands/ack`
- notifications: `jenix/runtime/notifications`
- ota request: `jenix/runtime/ota`
- ota ack: `jenix/runtime/ota/ack`

### Device Must Subscribe To

- `MQTT_DEVICE_COMMAND_TOPIC`
- `MQTT_OTA_REQUEST_TOPIC`

### Device Must Publish To

- `MQTT_DEVICE_COMMAND_ACK_TOPIC`
- `MQTT_OTA_ACK_TOPIC`

### Scene Device Command Payload

Published by the VPS to the command topic:

```json
{
  "deliveryId": "dispatch-...",
  "runId": "run-...",
  "sceneId": "scene-...",
  "homeId": "home-...",
  "source": "manual",
  "requestedAt": "2026-07-07T11:30:00.000Z",
  "deviceId": "JNX-TG-C3-A7F2",
  "command": "set_relay",
  "payload": {
    "relay": 1,
    "value": true
  }
}
```

### Scene Command Ack Payload

Published by the device after command execution:

```json
{
  "deliveryId": "dispatch-...",
  "deviceId": "JNX-TG-C3-A7F2",
  "acknowledgedAt": "2026-07-07T11:30:02.000Z",
  "status": "completed",
  "payload": {
    "relay": 1,
    "value": true
  }
}
```

Failure example:

```json
{
  "deliveryId": "dispatch-...",
  "deviceId": "JNX-TG-C3-A7F2",
  "acknowledgedAt": "2026-07-07T11:30:02.000Z",
  "status": "failed",
  "errorMessage": "Relay output is not available in current hardware mode"
}
```

### OTA Request Payload

Published by the VPS to the OTA topic:

```json
{
  "requestId": "ota-...",
  "deviceId": "JNX-TG-C3-A7F2",
  "homeId": "home-user-123",
  "pid": "JNX-TG-C3-201",
  "channel": "stable",
  "targetVersion": "1.0.1",
  "artifactUrl": "https://cdn.example.com/fw/tank-guard-pro-1.0.1.bin",
  "checksum": "sha256:abc123",
  "requestedAt": "2026-07-07T11:35:00.000Z",
  "requestedBy": "user-owner-123",
  "currentVersion": "1.0.0"
}
```

### OTA Ack Payload

Published by the device after OTA result:

```json
{
  "requestId": "ota-...",
  "deviceId": "JNX-TG-C3-A7F2",
  "acknowledgedAt": "2026-07-07T11:40:00.000Z",
  "status": "completed",
  "appliedVersion": "1.0.1"
}
```

Failure example:

```json
{
  "requestId": "ota-...",
  "deviceId": "JNX-TG-C3-A7F2",
  "acknowledgedAt": "2026-07-07T11:40:00.000Z",
  "status": "failed",
  "errorMessage": "Checksum mismatch"
}
```

## Scene Compatibility Requirements

If the device should participate in scenes, it must be compatible with these concepts:

- telemetry-driven triggers
- manual runs
- scheduled runs
- command delivery through MQTT
- command acknowledgement through MQTT

Platform scene command names:

- `refresh`
- `sync`
- `set_relay`
- `notify`
- `factory_reset`
- `ota_force`
- `matter_commission`
- `matter_bridge_sync`

Guidance:

- Only use scene commands that the hardware and firmware truly support.
- If a device cannot handle a command, do not model scenes around that command.
- `ota_force` is special: it results in an OTA delivery job rather than a normal device command message.

### Threshold Scenes Depend On Telemetry Keys

If you want threshold scenes like:

- tank level above 80
- temperature below 5
- relay state equals true

Then the telemetry keys must be stable and predictable across all units of that PID.

## HOME Sharing Compatibility

The device does not need custom firmware behavior for HOME sharing.

What matters:

- the device is registered under the correct `homeId`
- the backend enforces access by HOME role
- owners/admins/members/viewers get different permissions in the platform

Effect on device features:

- viewers cannot modify devices or request firmware updates
- writable roles can rename devices and request firmware
- scene/device access follows HOME membership

## OTA Compatibility Requirements

OTA works only when all of these align:

- the device PID exists
- the device hardware revision matches the published OTA release
- a release is published under `/api/v1/admin/ota/releases`
- the device can receive the MQTT OTA request
- the device publishes OTA acknowledgement

### OTA Release Example

```json
{
  "releaseId": "TANK-GUARD-PRO-1.0.1-HW1.0",
  "pid": "JNX-TG-C3-201",
  "hardwareRevision": "HW1.0",
  "version": "1.0.1",
  "channel": "stable",
  "artifactUrl": "https://cdn.example.com/fw/tank-guard-pro-1.0.1.bin",
  "checksum": "sha256:abc123",
  "status": "published",
  "notes": "Production release for HW1.0"
}
```

Device-side OTA expectations:

- validate artifact integrity
- apply the update
- reboot safely if needed
- publish final success or failure ack
- report the new `firmwareVersion` after success

## Device Icon And Device UI Representation

For a product to show up correctly in the platform, define visual metadata in the PID:

- `dashboard.templateId`
- `dashboard.dynamicPages`
- `dashboard.icon`
- `iconUrl`
- `imageUrl`

Current platform behavior:

- dashboard cards and some detail surfaces still render a PID-derived text badge
- dynamic device pages are selected from `dashboard.dynamicPages`
- unsupported dynamic pages fall back safely instead of breaking the route

What the device developer should do anyway:

- always provide proper visual metadata in the PID
- always choose a stable `templateId`
- always choose meaningful `dynamicPages`

Recommended dynamic pages today:

- `tank-level`
- `thresholds`
- `overview`

If you want a true custom rendered icon or richer custom page later, keep these PID fields stable now so the frontend can be upgraded without changing the firmware contract.

## Optional Public API Packaging

If the product should be exposed through third-party APIs:

1. Enable API metadata in the PID
2. Create an API package under `/api/v1/admin/api-packages`
3. Create HOME-scoped API keys under `/api/v1/api-keys`

Public routes currently exposed:

- `GET /api/v1/public/devices/:deviceId/state`
- `POST /api/v1/public/devices/:deviceId/commands`

This is optional for device onboarding. Do not block core device integration on it.

## Recommended Device Developer Checklist

Use this list for every new device:

- Create PID
- Fill hardware profile correctly
- Fill firmware profile correctly
- Fill dashboard metadata
- Add icon/image metadata
- Decide BLE or AP provisioning support
- Ensure the device exposes `deviceId` and `pid` during onboarding
- Ensure the device can receive Wi-Fi credentials
- Ensure the device can reach VPS/cloud
- Ensure the device can connect to MQTT
- Register the device with `pid`, `homeId`, `ownerUserId`, `hardwareRevision`, `firmwareVersion`
- Send telemetry with stable keys
- Support scene command consume plus ack
- Support OTA request consume plus ack
- Verify device appears in dashboard and device detail
- Verify telemetry updates `lastSeenAt`
- Verify a threshold scene can target the device
- Verify HOME sharing still allows the correct user roles
- Verify OTA plan resolves correctly
- Verify firmware rollout completes and updates `firmwareVersion`

## Minimal Validation Script For Every New Device

After integration, validate these scenarios:

1. Register a provisioning intent
2. Complete provisioning
3. Register the device
4. Load the dashboard and confirm the device appears
5. Send telemetry and confirm `lastSeenAt` updates
6. Create a scene that targets this device
7. Trigger the scene and confirm MQTT command delivery plus ack
8. Publish an OTA release for the PID and hardware revision
9. Request firmware update and confirm MQTT OTA request plus ack
10. Redeem a HOME share code with another user and confirm shared access works

## Known Current Limits

- Matter commissioning and bridge sync are still placeholder flows, not live commissioner transport.
- The current PWA stores icon metadata on the PID, but device cards still mainly show PID-derived text badges.
- Dynamic PID pages are partially implemented. Unknown page IDs fall back safely.

## Source Of Truth In This Repo

If this guide ever needs updating, these files are the canonical implementation references:

- [README.md](./README.md)
- [packages/device-schemas/src/pid/pid.types.ts](./packages/device-schemas/src/pid/pid.types.ts)
- [packages/shared/src/types/device.ts](./packages/shared/src/types/device.ts)
- [packages/shared/src/types/provisioning.ts](./packages/shared/src/types/provisioning.ts)
- [packages/shared/src/types/scene.ts](./packages/shared/src/types/scene.ts)
- [packages/shared/src/types/ota.ts](./packages/shared/src/types/ota.ts)
- [VPS/apps/api-server/src/app.ts](./VPS/apps/api-server/src/app.ts)
- [VPS/apps/api-server/src/infrastructure/mqtt/runtime.types.ts](./VPS/apps/api-server/src/infrastructure/mqtt/runtime.types.ts)
- [VPS/apps/api-server/src/modules/devices/device.routes.ts](./VPS/apps/api-server/src/modules/devices/device.routes.ts)
- [VPS/apps/api-server/src/modules/devices/device.service.ts](./VPS/apps/api-server/src/modules/devices/device.service.ts)
- [VPS/apps/api-server/src/infrastructure/http/require-device-auth.ts](./VPS/apps/api-server/src/infrastructure/http/require-device-auth.ts) — SEC-02 device key gate
- [VPS/apps/api-server/src/infrastructure/http/require-admin.ts](./VPS/apps/api-server/src/infrastructure/http/require-admin.ts) — SEC-01 admin key gate
- [PWA_APK/apps/web-pwa/src/features/home/](./PWA_APK/apps/web-pwa/src/features/home/) — mobile dashboard (telemetry → gauges); edit `telemetry/deviceTelemetry.ts` to surface a new device
- [VPS/apps/api-server/src/modules/provisioning/provisioning.routes.ts](./VPS/apps/api-server/src/modules/provisioning/provisioning.routes.ts)
- [VPS/apps/api-server/src/modules/provisioning/provisioning.service.ts](./VPS/apps/api-server/src/modules/provisioning/provisioning.service.ts)
- [VPS/apps/api-server/src/modules/scenes/scene.action-worker.ts](./VPS/apps/api-server/src/modules/scenes/scene.action-worker.ts)
- [VPS/apps/api-server/src/modules/ota/ota.service.ts](./VPS/apps/api-server/src/modules/ota/ota.service.ts)
