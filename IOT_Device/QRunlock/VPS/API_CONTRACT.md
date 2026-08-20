# QRunlock — PWA ↔ VPS API Contract

Audience: whoever builds the QRunlock frontend screens (a PWA feature
folder, per `PLATFORM_ARCHITECTURE_AND_ROLES.md` §4's "lighter option").
Build against exactly this contract and you never need to read this
package's source.

This is **not** the device-facing API. Firmware talks to the platform
through the generic contract in `DEVICE_INTEGRATION_GUIDE.md` (telemetry,
MQTT command/ack topics) — this document is the PWA-facing surface only.

---

## 0. Status

This PID (`JNX-QRU-C3-001`, matching `kPid` in
`IOT_Device/QRunlock/src/app/ProductIdentity.h`) has **not yet been issued**
through `POST /api/v1/admin/pids` — that's the platform lead's next step
before any of this is reachable in a real environment. This backend
package is built and tested against the platform contract already, so
issuing the PID and mounting the routes (see `HANDOFF.md`) is the only
remaining gap between this document and a live endpoint.

## 0.1 Conventions (same as every other plugin — see Smart Streamer's own API_CONTRACT.md §0)

- **Base path**: `/api/v1/qrunlock` for tenant-scoped resources (device
  list/detail, settings), plus per-device actions nested under
  `/api/v1/devices/:deviceId/qrunlock/...` — same nesting convention
  `token-dispenser.routes.ts` and Smart Streamer use.
- **Auth**: every route requires `requireAuthenticatedUser` — same
  bearer-JWT middleware every other tenant-facing module uses.
- **Tenant scope**: every request carries `x-home-id`. The backend
  resolves devices through `deps.getDevice`/`deps.listDevices`, which are
  already home-scoped by the platform — this package never trusts a raw
  header value beyond that.
- **Response envelope**: success is `{ "data": T }`.
- **Error envelope**:
  ```json
  { "error": { "code": "UNLOCK_COOLDOWN_ACTIVE", "message": "...", "request_id": "REQ-..." } }
  ```
- **Devices**: a QRunlock unit is a normal `DeviceRecord` in the
  `JNX-QRU-C3-001` PID family — reuses `modules/devices/` and
  `modules/pid/`, no parallel device table.

---

## 1. Devices

```
GET /api/v1/qrunlock/devices
```
Returns QRunlock devices owned by the current home only.
```json
{
  "data": [{
    "deviceId": "JNX-QRU-C3-0001",
    "friendlyName": "Front Door Lock",
    "onlineStatus": "online",
    "relayState": "idle",
    "lastUnlockAt": "2026-08-19T10:02:11Z",
    "lastUnlockReason": "app",
    "rfLearnStatus": "idle",
    "relayPulseMs": 300,
    "relayCooldownMs": 1500,
    "firmwareVersion": "1.0.0",
    "lastSeenAt": "2026-08-19T10:02:11Z"
  }]
}
```
`relayState` is always `"idle"` today — the relay is a momentary pulse
with no real-time ack channel yet (honest, not guessed at; see
`src/devices/device.service.ts`). `relayPulseMs` is always `300` and is
read-only — firmware fixes it at that value today
(`config::kMinRelayPulseMs === kMaxRelayPulseMs`).

```
GET /api/v1/qrunlock/devices/:deviceId
```
Same shape, single device. `404` with `QRUNLOCK_DEVICE_ERROR` if the
device isn't a QRunlock PID or isn't visible to the current home.

---

## 2. Unlock

```
POST /api/v1/devices/:deviceId/qrunlock/unlock
```
Request (all fields optional):
```json
{ "reason": "app", "requestId": "REQ-CLIENT-01" }
```
Success (`202` — this is a trigger, not a confirmed unlock; there is no
device ack path yet):
```json
{ "data": { "deviceId": "JNX-QRU-C3-0001", "status": "requested", "dispatchedAt": "2026-08-19T10:02:11Z", "cooldownMs": 1500 } }
```
Conflict — a second unlock requested before the configured
`relayCooldownMs` has elapsed since the last one:
```http
409 Conflict
```
```json
{
  "error": {
    "code": "UNLOCK_COOLDOWN_ACTIVE",
    "message": "Relay cooldown still active for JNX-QRU-C3-0001",
    "request_id": "...",
    "details": { "retryAfterMs": 800, "cooldownMs": 1500 }
  }
}
```
`requestId` makes a retry idempotent — resending the same `requestId`
returns the original dispatch instead of pulsing the relay twice, and does
not count as a second attempt against the cooldown.

---

## 3. RF-learn mode

Teaches the device a new RF remote code — corresponds to
`ControlApi::StartRfLearning()` / `CancelRfLearning()` in firmware.

```
POST /api/v1/devices/:deviceId/qrunlock/rf-learning/start
```
`202`, body `{ "data": { "deviceId": "...", "status": "learning", "startedAt": "...", "updatedAt": "..." } }`.
`409 RF_LEARN_ALREADY_ACTIVE` if already learning on this device.

```
POST /api/v1/devices/:deviceId/qrunlock/rf-learning/cancel
```
`200`, same shape with `status: "cancelled"`. `409 RF_LEARN_NOT_ACTIVE` if
nothing is active.

```
GET /api/v1/devices/:deviceId/qrunlock/rf-learning/status
```
`200`, current state. `status` can be `idle | learning | learned |
cancelled | timeout`. **`learned` is never returned by this backend
today** — there is no MQTT ack from firmware yet reporting a successful
pairing (see `HANDOFF.md` "Known limits"). `timeout` is a server-side
best-effort guess derived from the firmware's own 10s RF-learn window
(`config::kRfLearnWindowMs`), not a real device report. Use
`Cache-Control: no-store` awareness — this is meant to be polled while a
learn session is open.

---

## 4. Settings

```
GET /api/v1/qrunlock/devices/:deviceId/settings
PUT /api/v1/qrunlock/devices/:deviceId/settings
```
`PUT` body — every field optional, but at least one required (behaves as
a partial patch, not a full replace):
```json
{ "relayCooldownMs": 3000, "relayStateAfterPowerRestore": "remember", "switchType": "reset" }
```
- `relayCooldownMs` — integer `0`–`10000` (matches
  `config::kMaxRelayCooldownMs` in firmware).
- `relayStateAfterPowerRestore` — one of `"on" | "off" | "remember"`,
  default `"remember"`.
- `switchType` — one of `"reset" | "toggle" | "state"`, default `"reset"`.

**`relayPulseMs` cannot be set through this endpoint** — firmware fixes it
at `300`; there is nothing to configure. **`relayStateAfterPowerRestore`
and `switchType` are accepted and persisted, but firmware has no config
fields for either concept yet** (`IOT_Device/QRunlock/src/config/
ConfigTypes.h` only has `relayPulseMs`/`relayCooldownMs`/OTA fields) — a
successful `200` here means the platform remembers the user's choice, not
that the device behaves accordingly. Any invalid field in the body
rejects the whole request with `422 INVALID_REQUEST`, it does not silently
drop just that field. Response is the full settings record, same shape as
the `devices` list entry's settings fields.

---

## 5. Activity log

```
GET /api/v1/qrunlock/devices/:deviceId/activity
```
```json
{
  "data": [
    { "eventId": "...", "deviceId": "JNX-QRU-C3-0001", "type": "unlock", "source": "app", "occurredAt": "2026-08-19T10:02:11Z", "detail": "app" },
    { "eventId": "...", "deviceId": "JNX-QRU-C3-0001", "type": "rf_learn_start", "source": "app", "occurredAt": "2026-08-19T09:58:00Z" }
  ]
}
```
Newest first, capped at 50 events per device (this is a live feed, not a
durable audit log — see `src/activity/activity.model.ts`). `type` is one
of `unlock | rf_learn_start | rf_learn_cancel | rf_learn_timeout`. There
is deliberately no `auto_lock` type: the 10-second red&rarr;green
relock the frontend shows after an unlock is a client-side display timer
(see §2) — the backend never learns the relay physically reset, so it has
nothing true to log for that moment. Use `Cache-Control: no-store`
awareness — meant to be refetched on screen focus, not cached.

---

## 6. RF remotes (named, user-managed)

```
GET    /api/v1/qrunlock/devices/:deviceId/rf-remotes
POST   /api/v1/qrunlock/devices/:deviceId/rf-remotes        { "name": "Front Gate" }   (name optional, defaults "Remote N")
PATCH  /api/v1/qrunlock/devices/:deviceId/rf-remotes/:remoteId   { "name": "Garage" }
DELETE /api/v1/qrunlock/devices/:deviceId/rf-remotes/:remoteId
```
**Important semantics**: a record here means *the user told the platform
they paired a remote*, not that firmware confirmed an RF pairing
succeeded — there is no MQTT ack for that yet (§3, same limitation as
`rf-learning/status`'s `learned` state). Treat this list as the user's own
bookkeeping of remote names, not a hardware-verified registry. The
intended frontend flow: call `rf-learning/start`, wait for the pairing
window, then call `POST .../rf-remotes` to record it under a name the user
can edit.
`404 REMOTE_NOT_FOUND` if `remoteId` doesn't belong to the device.

---

## 7. Errors this contract defines

```
QRUNLOCK_DEVICE_ERROR
QRUNLOCK_ACTIVITY_ERROR
DEVICE_NOT_FOUND
UNLOCK_COOLDOWN_ACTIVE
RF_LEARN_ALREADY_ACTIVE
RF_LEARN_NOT_ACTIVE
REMOTE_NOT_FOUND
INVALID_REQUEST
INTERNAL_ERROR
```

---

## 8. OTA and telemetry

Not part of this contract — reuse the generic platform surfaces exactly
as documented in `DEVICE_INTEGRATION_GUIDE.md` (`/api/v1/admin/ota` for
firmware rollout, `/api/v1/devices/:deviceId/telemetry` for device-side
reporting). This package adds no OTA or telemetry endpoints of its own.
