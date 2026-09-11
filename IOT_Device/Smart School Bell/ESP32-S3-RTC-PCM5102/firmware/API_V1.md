# Jenix School Bell API v1.4

The embedded WebUI and future PWA/Android APK use the same local HTTP API.
Normal bell execution does not depend on internet or a desktop computer.

## Commissioning access

- SSID: `JENIX-SCHOOL-BELL`
- password: `JenixBell@123`
- WebUI: `http://192.168.4.1/`
- API base: `http://192.168.4.1/api/v1`
- live contract: `GET /api/v1/capabilities`
- LAN address after Wi-Fi join: `status.station_ip`
- zero-config hostname: `http://jnx-sb-<MAC-suffix>.local/`

The AP stays enabled while the station interface connects to school Wi-Fi.
Wi-Fi credentials are kept in ESP32 NVS. Configuration, schedules, logs and the
normal sound library are stored in internal LittleFS; an SD card is optional.
`status.local_time` is the authoritative school time used for schedule matching.
The WebUI displays it as a live clock and resynchronizes with the ESP32 every
30 seconds.

## Bell-management actions

| Action | Method and path | Input / behavior |
|---|---|---|
| Capabilities | `GET /api/v1/capabilities` | Machine-readable actions and schemas |
| Status | `GET /api/v1/status` | PID/device ID, LAN IP, mDNS, RTC local/Unix time, timezone, SD, Wi-Fi, cloud/OTA, auto-bell and timetable state |
| Settings | `GET`, `PUT /api/v1/config` | School name, volume, timezone/POSIX rule and station Wi-Fi; changes apply without reboot |
| Cloud bridge | `GET`, `PUT /api/v1/cloud` | QRunlock-compatible HOME ID, broker host/port and enabled state |
| MQTT credential | `PUT /api/v1/device-mqtt-credential` | Device credential and `activateForCloudBroker`; password is never returned |
| Active schedule | `GET`, `PUT /api/v1/schedules` | Backward-compatible active-profile schedule array |
| Timetable profiles | `GET`, `PUT /api/v1/schedule-profiles` | Complete `SchedulePack` |
| Activate profile | `PUT /api/v1/active-profile` | `{ "profile_id": "winter" }` |
| Pause/resume auto bells | `PUT /api/v1/automation` | `{ "enabled": false }`; manual ring remains available |
| Holidays | `GET`, `PUT /api/v1/holidays` | Complete validated holiday array |
| Bell presets | `GET`, `PUT /api/v1/presets` | Complete validated preset array |
| Sounds | `GET /api/v1/sounds` | Combined internal, festival and optional SD library with encoded duration and `source` |
| Internal sounds | `GET /api/v1/internal/sounds` | Lists only reusable internal-flash sounds |
| Browse bell folders | `GET /api/v1/sd/browse?path=/bells` | Restricted, paginated folder browser; never escapes `/bells` |
| Preview/download sound | `GET /api/v1/sounds/content?name=FILE` or `?path=/bells/...` | Streams the selected file as `audio/mpeg` or `audio/wav` for PWA/APK playback |
| Upload internal sound | `POST /api/v1/internal/sounds?name=FILE` | Raw MP3/WAV body; rejected with 507 when internal flash is insufficient |
| Delete sound | `DELETE /api/v1/sounds?name=FILE` | Rejected while used by a schedule/preset or if it is the last sound |
| Festival slot | `GET /api/v1/festival` | Current one-off file or `null`; schedule/manual ID is `festival/current` |
| Upload festival | `POST /api/v1/festival/upload?name=FILE` | Raw MP3/WAV body; atomically replaces the one-off slot |
| Preview festival | `GET /api/v1/festival/content` | Streams the temporary file |
| Clear festival | `DELETE /api/v1/festival` | Rejected while `festival/current` is used by a schedule |
| Soft PTT | `WS /api/v1/announcement/ws` | Raw mono PCM contract in `SOFT_PTT_CONTRACT.md` |
| Manual ring | `POST /api/v1/bell/ring` | Name, `soundId`, duration |
| Hardware test tone | `POST /api/v1/audio/diagnostic` | Plays a generated 1 kHz tone for 2 seconds through PCM5102 |
| RTC | `POST /api/v1/time` | `{ "local_time": "YYYY-MM-DDTHH:MM:SS" }` |
| Logs | `GET /api/v1/logs?limit=200` | Newest-first runtime log lines |
| Clear logs | `DELETE /api/v1/logs` | Clears runtime log |
| Format SD | `POST /api/v1/sd/format` | Destructive; requires `{ "confirm": "FORMAT" }` |

## Timetable profiles and automatic selection

Regular, summer, winter, exam and any future timetable are generic named
profiles. The firmware does not hard-code their names. `active_profile_id` is
the default. A matching calendar rule overrides it for its date range and
weekdays. The matching enabled rule with the highest priority wins. Set
`repeat_yearly` for recurring summer/winter ranges, including ranges that cross
New Year.

An exam on one date uses the same date in `start_date` and `end_date`. A full
exam period or season uses a range. Holidays always suppress automatic bells,
but manual ring remains available.

```json
{
  "active_profile_id": "regular",
  "automation_enabled": true,
  "profiles": [
    {
      "id": "regular",
      "name": "Regular Timetable",
      "category": "regular",
      "enabled": true,
      "schedules": [
        {
          "id": 1,
          "name": "Morning Assembly",
          "time": "08:00",
          "type": "assembly",
          "sound_id": "16-Assembly",
          "duration": 10,
          "days": [1, 2, 3, 4, 5],
          "enabled": true
        }
      ]
    },
    {
      "id": "winter",
      "name": "Winter Timetable",
      "category": "winter",
      "enabled": true,
      "schedules": []
    },
    {
      "id": "exam-final",
      "name": "Final Exam Bells",
      "category": "exam",
      "enabled": true,
      "schedules": []
    }
  ],
  "calendar_rules": [
    {
      "id": 1,
      "name": "Winter season",
      "profile_id": "winter",
      "start_date": "2026-11-01",
      "end_date": "2027-02-28",
      "priority": 10,
      "repeat_yearly": true,
      "days": [1, 2, 3, 4, 5, 6],
      "enabled": true
    },
    {
      "id": 2,
      "name": "Final exams",
      "profile_id": "exam-final",
      "start_date": "2027-02-10",
      "end_date": "2027-02-25",
      "priority": 100,
      "repeat_yearly": false,
      "days": [1, 2, 3, 4, 5, 6],
      "enabled": true
    }
  ]
}
```

Day values are `0=Sunday` through `6=Saturday`. Maximums are 16 profiles, 256
schedule entries per profile and 128 calendar rules. Updates are validated,
written atomically to internal flash, and activated without rebooting.

`automation_enabled=false` temporarily suppresses every scheduled bell without
deleting profiles or rules. It is persisted in internal flash and does not block
manual ring actions.

## Other payloads

Holiday:

```json
{"date":"2026-10-02","name":"Gandhi Jayanti","type":"holiday"}
```

Bell preset:

```json
{"id":1,"label":"Emergency Bell","sound_id":"21-Siren","duration":20,"category":"emergency"}
```

For desktop-project compatibility, schedule input accepts both `sound_id` and
legacy `sound`; preset input accepts `sound_id`/`sound` and `duration`/`dur`.
Responses use the canonical names documented above.

## PWA/APK compatibility rules

- Discover the device and query `/api/v1/capabilities`.
- Use advertised actions rather than assuming a firmware version.
- Ignore unknown response fields for forward compatibility.
- Never expect a Wi-Fi password in read responses.
- Send complete arrays/packs for replacement endpoints.
- Stream audio as the raw request body, not multipart form data.
- Require explicit user confirmation for formatting and log clearing.
- Legacy `/api/status` and `/api/bell/ring` remain available.

API v1.4 has no application-level login. The setup AP is WPA2 protected, but
authentication must be added before write APIs are exposed to an untrusted LAN.

## `/bells` SD-card library

The firmware treats `/bells` and every child folder as the operator-managed
sound library. Only regular `.mp3` and `.wav` files are exposed. A unique,
path-based ID prevents collisions when different folders contain the same file
name:

```text
/bells/Regular/period.mp3  -> bells/Regular/period.mp3
/bells/Exam/period.mp3     -> bells/Exam/period.mp3
```

Use the returned `sound_id` unchanged in schedules, presets and manual-ring
requests. Folder listing is lazy and supports `offset` plus `limit` (maximum
100). `GET /sounds` and `/sd/browse` return actual encoded-media duration;
`null` means the file header/frame sequence could not be parsed. The embedded
WebUI can navigate folders, select/preview/play a file, or create a schedule row
with that file already selected.

## Jenix One MQTT/OTA contract

Product identity is stable and hardware-derived:

```text
PID:       JNX-SB-S3-001
deviceId:  JNX-SB-S3-<last 6 hex digits of station MAC>
```

The bridge uses the frozen platform topic shape
`jnx/{homeId}/{pid}/{deviceId}/{suffix}`. It publishes retained online status
with bell state, `sd_ready`, `automation_enabled` and `local_time`; the broker
publishes retained offline LWT. It subscribes to `ota` and publishes results to
`ota/ack`. OTA accepts the platform `requestId`, `deviceId`, `pid`,
`targetVersion`, `artifactUrl` and `checksum` payload, requires a SHA-256
checksum, validates the image, selects an OTA partition, acknowledges the
result, then reboots after success. Provisioning/registration remains outside
this firmware pass; HOME ID and the per-device MQTT credential are entered via
the exposed local API/WebUI just like the proven QRunlock pilot mechanism.
