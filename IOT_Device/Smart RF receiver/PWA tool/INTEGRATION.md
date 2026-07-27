# Smart RF Nurse Call Receiver — Jenix One Integration Guide

> **Status:** Backend module and dynamic UI package are built directly in the platform
> repo (not staged here for copy-paste, unlike Smart RF Transmitter / Token Dispenser).
> What's left is activation: create the PID, register the UI package, and bench-test.

Unlike its siblings, this folder has no `backend/`/`frontend/` staging copies to paste in —
the code already lives in the main `jenix One` monorepo. This file documents where, and
what's still needed to go live.

## Product identity

- **PID:** `JNX-RFNC-C3-01` (the platform requires the `JNX-...` product-identity format;
  the firmware's own docs use its internal code `PD-RFNC-01` — that stays the hardware
  team's label, `JNX-RFNC-C3-01` is the platform-facing PID)
- **Product name:** Jenix Smart RF Nurse Call Receiver
- **Hardware:** ESP32-C3 + SRX882S, AP+STA Wi-Fi, BLE (Wi-Fi onboarding only), ESP-NOW
- **Firmware version delivered:** `0.1.0` (see `firmware/DELIVERY_HANDOFF.md`)

## Where the platform-side code lives

| Concern | Path |
|---|---|
| Backend module | `VPS/apps/api-server/src/modules/nurse-call-receiver/` |
| Backend tests | `VPS/apps/api-server/src/modules/nurse-call-receiver/nurse-call-receiver.test.ts` |
| MQTT events/status ingress fan-out | `VPS/apps/api-server/src/infrastructure/mqtt/runtime.handlers.ts` (`handleRuntimeDeviceEventsMessage`/`handleRuntimeDeviceStatusMessage`, routed by PID) |
| Dynamic UI package (authoring copy) | `PWA_APK/apps/web-pwa/public/ui-packages/nurse-call-receiver-mobile/1.0.0/` |
| Package registry admin screen | `admin-backend-ui` → Package Registry |

## Step 1 — Create the PID

Via the admin PID Management screen (or `POST /api/v1/admin/pids` with `x-admin-key` +
`x-role: JENIX_DEVELOPER`):

```json
{
  "pid": "JNX-RFNC-C3-01",
  "productName": "Jenix Smart RF Nurse Call Receiver",
  "productCategory": "Nurse Call",
  "productLine": "RF Nurse Call",
  "status": "beta",
  "matterMode": "NONE",
  "brand": "JENIX",
  "hardware": { "mcu": "ESP32-C3", "hardwareRevision": "HW1.0", "hasBle": true, "hasWifi": true, "hasMatter": false, "hasThread": false, "hasEthernet": false, "hasRs485": false },
  "firmware": { "firmwareFamily": "nurse-call-receiver", "otaChannel": "stable", "stableVersion": "0.1.0", "rollbackAllowed": true },
  "matter": { "enabled": false, "mode": "NONE", "bridgeSupported": false },
  "api": { "enabled": false, "sellable": false, "allowedScopes": [] },
  "ui": { "uiMode": "remote-package", "uiPackageId": "nurse-call-receiver-mobile", "uiPackageVersion": "1.0.0" },
  "dashboard": { "templateId": "nurse-call-receiver-panel", "dynamicPages": ["nurse-call-receiver-mobile"] }
}
```

## Step 2 — Register the UI package

Via the Package Registry admin screen (or `POST /api/v1/admin/ui-packages`):

```json
{
  "packageId": "nurse-call-receiver-mobile",
  "pid": "JNX-RFNC-C3-01",
  "displayName": "Nurse Call Receiver remote UI",
  "version": "1.0.0",
  "manifestPath": "/ui-packages/nurse-call-receiver-mobile/1.0.0/manifest.json",
  "entryPath": "/ui-packages/nurse-call-receiver-mobile/1.0.0/remoteEntry.js",
  "exportName": "NurseCallReceiverDynamicPage",
  "publishImmediately": false
}
```

Leave `publishImmediately: false` (draft) until bench testing passes, then publish it
from the Package Registry screen — no code change or redeploy needed to flip it live.

## Step 3 — MQTT topic mapping (canonical scheme, not the firmware doc's own scheme)

The firmware's own docs (`firmware/MQTT_API.md`) describe a bespoke topic tree
(`jenixone/v1/{tenantId}/{siteId}/PD-RFNC-01/{deviceId}/...`). The platform now uses one
frozen scheme for every device — see `MQTT_LICENSED_DEVICE_ACCESS_PLAN.md` and
`packages/shared/src/utils/mqtt-topics.ts`:

```
jnx/{tenantId}/{pid}/{deviceId}/{suffix}
```

`tenantId` = the device's owning HOME id. Configure the device (via
`PUT /api/v1/config` locally, or the eventual enrollment flow) to publish/subscribe on:

| Firmware concept | Canonical topic |
|---|---|
| `state`, retained `telemetry/status` snapshot | `jnx/{tenantId}/JNX-RFNC-C3-01/{deviceId}/status` |
| `event` (call raised/repeated, remote added, health) | `jnx/{tenantId}/JNX-RFNC-C3-01/{deviceId}/events` |
| `command` (refresh/restart/start_learning/attend_call/factory_reset) | `jnx/{tenantId}/JNX-RFNC-C3-01/{deviceId}/cmd` (subscribe) |
| `command/ack` | `jnx/{tenantId}/JNX-RFNC-C3-01/{deviceId}/cmd/ack` (publish) |
| `ota`, `ota/ack` | `jnx/{tenantId}/JNX-RFNC-C3-01/{deviceId}/ota`, `.../ota/ack` |

Events payload the backend understands today (`runtime.handlers.ts`):
```json
{ "eventType": "call_raised", "remoteName": "Bed 12 Call", "bedId": "BED-12", "remoteSlot": "2" }
```
Status payload fields read today: `pairedRemotes`, `activeCalls`, `mode`, `wifiConnected`,
`mqttConnected`, `espNowStatus`.

## REST API (platform-facing, all require an authenticated app user)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/devices/:deviceId/nurse-call/remotes` | List learned remotes |
| POST | `/api/v1/devices/:deviceId/nurse-call/remotes` | Save a learned remote's metadata |
| GET | `/api/v1/devices/:deviceId/nurse-call/calls/active` | Active calls |
| GET | `/api/v1/devices/:deviceId/nurse-call/calls/history` | Attended history |
| POST | `/api/v1/devices/:deviceId/nurse-call/calls/:callId/attend` | Attend a call (also dispatches `attend_call` to the device) |
| POST | `/api/v1/devices/:deviceId/nurse-call/commands` | `{ "command": "refresh"\|"restart"\|"start_learning"\|"attend_call"\|"factory_reset" }` — `factory_reset` requires owner/admin HOME access |

## What the v1 remote page shows (and what it doesn't yet)

`NurseCallReceiverDynamicPage` renders the active-call count, paired-remote count, and
connectivity/health status from the generic per-device runtime channel
(`GET /api/v1/devices/:deviceId/ui-runtime`), plus refresh/learn/restart buttons — the
same contract Tank Guard's page uses. It does **not** yet render the live active-calls
list with an inline Attend button, because that channel only carries flat telemetry
primitives, not lists. Until the host is extended (either an authenticated fetch
capability for remote pages, or a compact calls summary folded into the telemetry
snapshot), operate the calls list from `admin-backend-ui` or a direct API client. This is
a known, intentional scope line — flagged here rather than silently shipped as if it
worked.

## Non-negotiable platform rules this device follows

Same as every device (see `DEVICE_INTEGRATION_GUIDE.md`): PID created before device
registration, PID is root identity for UI/OTA/telemetry meaning, HOME membership
controls access, sharing changes who can operate the device not the device contract.

## Bench checklist

Before publishing the package, run the acceptance checklist already defined in
`firmware/DELIVERY_HANDOFF.md`, then additionally verify:

- [ ] PID `JNX-RFNC-C3-01` created and approved
- [ ] Package registered as draft, then published after bench pass
- [ ] Device registered against a real HOME (`POST /api/v1/devices/register`)
- [ ] A learned remote press produces a `call_raised` event that appears in
      `GET .../nurse-call/calls/active` within a few seconds
- [ ] Attending the call moves it to `.../calls/history` and the device receives
      `attend_call` (check serial monitor / MQTT ack topic)
- [ ] `factory_reset` is rejected for a non-owner/admin HOME member (403)
