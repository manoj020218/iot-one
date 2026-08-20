# Smart Streamer — PWA ↔ VPS API Contract

Audience: the VPS/api-server developer. This is the interface the Jenix One
PWA plugin (`web-pwa/src/features/streamer/`) will call. Build the VPS
implementation to satisfy exactly this contract and you can work fully
independently of the PWA team — they are building against these same
shapes on their side, per `PWA tool/UI_UX_PLAN.md`.

This is **not** the device-facing API. Firmware calls a separate, smaller
set of endpoints — see `firmware/API_CONTRACT.md` in the Smart Streamer
firmware folder. Do not merge the two; the PWA never signs requests the way
firmware does, and firmware never sees a user JWT.

---

## 0. Conventions (already established by the platform — reuse, don't reinvent)

- **Base path**: `/api/v1/streamer` for tenant-scoped resources (cameras,
  destinations, schedules, sessions — modeled on how `/api/v1/scenes` is
  mounted for `sceneRouter` in `app.ts`), plus per-device actions nested
  under the existing `/api/v1/devices/:deviceId/streamer/...` the same way
  `token-dispenser.routes.ts` nests `/:deviceId/token-dispenser/...`.
- **Auth**: every route below requires `requireAuthenticatedUser`
  (`infrastructure/http/request-auth.ts`) — same bearer-JWT middleware
  every other tenant-facing module uses. No new auth mechanism.
- **Tenant scope**: every request carries `x-home-id`
  (`app/apiHeaders.ts` on the PWA side). The VPS must validate the
  authenticated user is actually a member of that home before touching any
  row — never trust the header value alone (VPS prompt §6).
- **Response envelope**: success responses are `{ "data": T }` — matches
  `fetchAuthenticatedJson<T>()` in `app/authenticatedRequest.ts`, which
  unwraps `payload.data` unconditionally. Do not return bare objects.
- **Error envelope**:
  ```json
  { "error": { "code": "DEVICE_ALREADY_STREAMING", "message": "...", "request_id": "REQ-..." } }
  ```
  `code` is the stable machine-readable value the PWA switches on (see
  `constants/errorCodes.ts` in the UI plan) — never change a `code` string
  without updating the PWA in the same change.
- **Devices**: a Smart Streamer P4 is a normal `DeviceRecord` (`deviceId`,
  `pid`) in the `STREAMER` PID family — reuse `modules/devices/` and
  `modules/pid/`, do not create a parallel device table.

---

## 1. Devices (Smart Streamer subset of the existing device list)

```
GET /api/v1/streamer/devices
```
Returns Smart Streamer devices owned by the current home only (filter
existing `devices` by PID family = `STREAMER`).
```json
{
  "data": [{
    "deviceId": "JNX-P4-000101",
    "friendlyName": "Front Gate Camera",
    "onlineStatus": "online",
    "streamState": "IDLE",
    "assignedCameraId": "CAM-0001",
    "activeSessionId": null,
    "activeDestinationPlatform": null,
    "nextScheduleAt": "2026-08-04T18:00:00+05:30",
    "wifiRssi": -58,
    "firmwareVersion": "1.0.0",
    "lastSeenAt": "2026-08-04T10:02:11Z"
  }]
}
```
`streamState` is the exact device state-machine value reported via device
heartbeat (see firmware contract §5) — the VPS must pass it through
unmodified, not reinterpret it, so the PWA's `StreamStateChip` component
stays a pure lookup table.

```
GET  /api/v1/streamer/devices/:deviceId          -> device detail (adds camera/destination/schedule summaries)
POST /api/v1/devices/:deviceId/streamer/restart-pipeline
POST /api/v1/devices/:deviceId/streamer/restart-device
POST /api/v1/devices/:deviceId/streamer/release   -> unassign from tenant (audit-logged, confirmation required client-side)
```

---

## 2. Camera profiles

```
GET    /api/v1/streamer/cameras
POST   /api/v1/streamer/cameras
GET    /api/v1/streamer/cameras/:cameraId
PUT    /api/v1/streamer/cameras/:cameraId
DELETE /api/v1/streamer/cameras/:cameraId          -> 409 if assigned to a device or schedule
POST   /api/v1/streamer/cameras/:cameraId/assign   -> { "deviceId": "..." }
POST   /api/v1/streamer/cameras/:cameraId/test     -> see below
```

`POST .../test` is long-running (RTSP DESCRIBE/SETUP/PLAY round trip
through the device, not the VPS — VPS just relays the command and polls
result). Request:
```json
{ "deviceId": "JNX-P4-000101" }
```
Response, matching the 6-step checklist in Streamer Plugin.txt §8:
```json
{
  "data": {
    "testId": "TEST-01K1P4",
    "status": "in_progress",
    "steps": [
      { "step": "reachable", "status": "passed" },
      { "step": "rtsp_auth", "status": "passed" },
      { "step": "video_codec", "status": "in_progress" },
      { "step": "audio_codec", "status": "pending" },
      { "step": "keyframe", "status": "pending" },
      { "step": "passthrough_compatible", "status": "pending" }
    ]
  }
}
```
`GET /api/v1/streamer/cameras/:cameraId/test/:testId` polls until
`status: "passed" | "failed" | "timeout"`.

**Critical**: `GET`/`LIST` responses **must never include** `rtsp_password`
in any form — not masked, not present. The field only ever appears in the
`PUT`/`POST` request body, write-only. This isn't a UI convention, it's a
server contract: omit the key entirely from every read response.

---

## 3. Destination profiles

```
GET    /api/v1/streamer/destinations
POST   /api/v1/streamer/destinations
GET    /api/v1/streamer/destinations/:destinationId
PUT    /api/v1/streamer/destinations/:destinationId
DELETE /api/v1/streamer/destinations/:destinationId   -> 409 if referenced by a schedule
POST   /api/v1/streamer/destinations/:destinationId/validate
```

`platform` is one of `"youtube" | "facebook" | "instagram"`. Same rule as
cameras: `stream_key` / `oauth_reference` are write-only, never echoed back
— `GET` returns `hasStreamKey: true` plus `credentialExpiry` /
`lastValidatedAt`, nothing secret.

```json
{
  "data": {
    "destinationId": "DEST-00017",
    "platform": "instagram",
    "displayName": "Temple Live — IG",
    "credentialMode": "temporary",
    "hasStreamKey": true,
    "credentialExpiry": "2026-08-04T20:00:00Z",
    "lastValidatedAt": "2026-08-04T09:00:00Z",
    "enabled": true
  }
}
```

---

## 4. Schedules — built on the existing Scenes engine, not a new store

**Correction from an earlier draft of this contract**: this section
originally proposed a standalone `/api/v1/streamer/schedules` CRUD store.
That was wrong — `VPS/apps/api-server/src/modules/scenes/` is already a
working, generic, home-scoped automation engine (`scene.scheduler.ts` runs
a leader-elected tick that evaluates every home's active Scenes; triggers,
conditions, and actions are already device-agnostic). Building a second
scheduling engine next to it would duplicate real infrastructure. Reuse it.

**The PWA-facing surface stays as originally specified** — the plugin
should never need to know Scenes exist underneath:

```
GET    /api/v1/streamer/schedules?deviceId=&from=&to=
POST   /api/v1/streamer/schedules
GET    /api/v1/streamer/schedules/:scheduleId
PUT    /api/v1/streamer/schedules/:scheduleId
DELETE /api/v1/streamer/schedules/:scheduleId
POST   /api/v1/streamer/schedules/:scheduleId/duplicate
POST   /api/v1/streamer/schedules/:scheduleId/run-now
```
Field set matches VPS prompt §13 (`device_id, camera_id, destination_id,
timezone, start_local_time, stop_local_time, days_of_week, start_date,
end_date, enabled, priority`), `timezone` defaulting to `Asia/Kolkata`.

**What the VPS implementation does underneath, and why it can't be a
straight passthrough to the Scene API:**

1. `SceneSchedule` (`packages/shared/src/types/scene.ts`) is a **single
   fire-time** — `{ timezone, daysOfWeek, time }` — not a start+stop
   window. One Smart Streamer schedule (`start_local_time` +
   `stop_local_time`) becomes **two linked Scene records**: one with a
   schedule trigger at `start_local_time` whose action is `start_stream`,
   one at `stop_local_time` whose action is `stop_stream`. Store the link
   (e.g. a shared `scheduleId` in each Scene's action `payload`) so
   `PUT`/`DELETE`/`duplicate` can find and update both atomically.
2. `SceneActionCommand` needs two new values added —
   `"start_stream" | "stop_stream"` — alongside the existing
   `refresh | sync | set_relay | ...` union. Small, additive, but it's a
   change to a **shared** file every other module's Scenes also use —
   coordinate it, don't fork the type.
3. **Overlap/session-lock validation has no Scenes equivalent** — Scenes
   will happily let you create two conflicting schedules for the same
   device. This module must validate against *other Smart Streamer
   schedules for the same device* itself, before writing either paired
   Scene, and reject with:
   ```json
   { "error": { "code": "SCHEDULE_CONFLICT", "message": "This device is already scheduled for YouTube from 18:00 to 19:00.", "request_id": "..." } }
   ```
4. `run-now` calls the existing manual-run Scene path (`ManualRunPayload`)
   for the `start_stream` Scene of the pair — don't build a separate
   manual-trigger mechanism.
5. `GET .../schedules` reconstructs the PWA-facing shape by reading both
   Scenes in a pair and projecting `start_local_time`/`stop_local_time`
   back out — the pairing is invisible outside this module.

---

## 5. Sessions (manual start/stop, live status)

```
POST /api/v1/devices/:deviceId/streamer/sessions/start
```
```json
{ "cameraId": "CAM-0001", "destinationId": "DEST-00017", "plannedStopAt": null }
```
Success:
```json
{ "data": { "sessionId": "SES-20260804-0012", "status": "REQUESTED" } }
```
Conflict (device already streaming — Streamer Plugin §10):
```http
409 Conflict
```
```json
{
  "error": {
    "code": "DEVICE_ALREADY_STREAMING",
    "message": "This Smart Streamer is already live on YouTube.",
    "request_id": "...",
    "details": { "activeSessionId": "SES-20260803-0012", "activePlatform": "youtube" }
  }
}
```
The PWA renders this from `error.code`, not from the 409 status alone —
also design a separate `DESTINATION_LOCKED` code for the destination-lock
case (VPS prompt §11), since it needs different copy and a different
recovery action ("Stop and Switch" vs. "choose another destination").

```
POST /api/v1/devices/:deviceId/streamer/sessions/stop        { "sessionId": "...", "reason": "user" }
POST /api/v1/devices/:deviceId/streamer/sessions/force-stop   -> requires smart_streamer.stream.force_stop, always audit-logged
GET  /api/v1/streamer/sessions/:sessionId
```
`GET` session response feeds the Live Session page directly — return every
field listed in Streamer Plugin §11 (`platform, destinationProfile,
device, camera, startTime, duration, triggerSource, videoMode, audioMode,
connectionStatus, reconnectCount, currentBitrate, lastTelemetry,
plannedStopAt`) so the PWA does no client-side derivation.

Use `Cache-Control: no-store` on this endpoint (VPS prompt §12) — it's
polled every 10–30s per the adaptive-polling plan and must never be
cached by an intermediary.

---

## 6. Diagnostics / health

```
GET /api/v1/streamer/devices/:deviceId/health
```
Passes through the device heartbeat payload (firmware contract §5) plus
VPS-known fields (`lastSeenAt`, `reconnectCount` computed server-side from
session history). Apply the "never include" list from Streamer Plugin §15
server-side too — even if a bug ever put a secret in device telemetry, the
VPS response is the last line of defense before it reaches a browser.

```
GET /api/v1/streamer/devices/:deviceId/diagnostics/export
```
Returns a sanitized, downloadable report (VPS prompt §25).

---

## 7. OTA

**Do not build new endpoints.** Reuse `/api/v1/admin/ota` (`ota.routes.ts`)
and the PWA's existing `DeviceFirmwarePanel.tsx` /
`getResolvedFirmwarePlan()` / `requestFirmwareUpdate()` exactly as they
work for every other device type today. The only Smart Streamer–specific
addition is a **pre-flight check** on `requestFirmwareUpdate` for
`pid` family `STREAMER`: reject with a clear error if the device's
`streamState` is not `IDLE`/`STOPPED` (VPS prompt §21 / Streamer Plugin
§26 — "Stop the active stream before updating firmware").

---

## 8. Notifications

Streamer Plugin §16 asks for stream-lifecycle notifications through "the
existing Jenix One notification framework." **That framework does not
exist yet** (confirmed: no `notifications`/`alerts` module anywhere under
`api-server/src/modules/`). This is platform-level work, not something the
Smart Streamer VPS module can build in isolation — see
`SMART_STREAMER_PLATFORM_ADDITIONS.md` at the repo root. Until it lands,
stub the trigger points (emit an internal event on stream
started/stopped/failed, credential expiry, device offline) so wiring in a
real notification sink later is a one-line change, not a re-architecture.

---

## 9. Permissions

Enforce every `smart_streamer.*` permission from Streamer Plugin §17
**server-side**, on every route above — the PWA hiding a button is not
enforcement (VPS prompt's own general rule, and Streamer Plugin §17 says
it explicitly: "Do not create role checks only in the frontend"). Given
the current admin-role gap noted in `SMART_STREAMER_PLATFORM_ADDITIONS.md`
(`x-role` header is spoofable today), Smart Streamer permission checks
should key off the same authenticated-user + home-membership data already
validated by `requireAuthenticatedUser`, not off the admin-only
`x-role`/`x-admin-key` path used by PID/OTA admin routes.

---

## 10. Errors this contract defines

Keep this list in sync with `constants/errorCodes.ts` on the PWA side and
the device-side error model in `firmware/API_CONTRACT.md §7`:

```
DEVICE_ALREADY_STREAMING
DESTINATION_LOCKED
SCHEDULE_CONFLICT
DESTINATION_CREDENTIAL_EXPIRED
CAMERA_TEST_FAILED
CAMERA_TEST_TIMEOUT
SESSION_NOT_FOUND
SESSION_ALREADY_STOPPED
OTA_BLOCKED_STREAM_ACTIVE
DEVICE_OFFLINE
TENANT_MISMATCH
```
