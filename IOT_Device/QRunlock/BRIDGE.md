# Jenix One — Device Cloud Bridge Standard

**Applies to:** every current and future Jenix One device that needs to receive
remote commands (unlock a lock, toggle a relay, run OTA) from the platform,
not just report sensor telemetry.
**Companion to:** `PROVISIONING.md` (how a device gets its Wi-Fi credentials
and, eventually, joins a HOME). This document starts **after** provisioning —
once the device has Wi-Fi, this is how it actually talks to Jenix One.
**Status:** implemented and hardware-verified for QRunlock
(`src/cloud/CloudBridgeService.*`), 2026-08-20. Use QRunlock's `src/cloud/`
folder as the template — copy it, don't re-derive the topic scheme or the
reconnect logic from scratch.

---

## Executive Summary

A device that only reports telemetry (Tank Guard's water level, a sensor
reading) has one job: publish. A device the platform needs to **command**
(QRunlock's unlock pulse, a relay toggle, an OTA install request) has a
second job: subscribe to a command topic, act on what arrives, and publish
proof it did. That second job is "the bridge" — the MQTT client, the topic
scheme, the command dispatch, the acknowledgement.

QRunlock is the first device in this repo to implement it end-to-end against
the platform's own **canonical** topic scheme (as opposed to the several
already-flashed devices — Tank Guard, Token Dispenser, Smart RF Transmitter —
that predate the freeze and use their own per-family topic roots, bridged
into the platform via `legacyTopicRoots` in `mqtt-runtime-bridge.ts`). Every
device built from here on should follow this document, not the legacy
examples.

---

## 1. The Topic Scheme (frozen, do not invent a new one)

Source of truth: `packages/shared/src/utils/mqtt-topics.ts`.

```
jnx/{tenantId}/{pid}/{deviceId}/{suffix}
```

- `tenantId` — the owning Jenix HOME's id. Always a HOME id today; the field
  exists so a future vendor/OEM tenant can occupy the same slot without a
  scheme change.
- `pid` — the device's Product ID (`app::kPid` in firmware).
- `deviceId` — the device's own stable id (`identity_.DeviceId()` — see
  `DeviceIdentity.cpp`, format `JNX-{code}-{6-hex-MAC}`).
- `suffix` — one of a fixed, small set. Device-specific data rides inside the
  JSON payload, never as new topic segments:

| Suffix | Direction | Purpose |
|---|---|---|
| `telemetry` | device → cloud | sensor/state readings (optional — skip if the device has none, like QRunlock) |
| `status` | device → cloud | explicit app-level status announcements (retained) |
| `events` | device → cloud | discrete event stream (optional) |
| `cmd` | cloud → device | commands the platform dispatches |
| `cmd/ack` | device → cloud | acknowledgement of a `cmd` message |
| `ota` | cloud → device | OTA install requests |
| `ota/ack` | device → cloud | OTA result |
| `lwt` | device → cloud (broker-managed) | Last-Will-and-Testament — the broker publishes this automatically on an ungraceful disconnect |

Build every topic with the same helper (`cloud::BuildTopic` in
`src/cloud/CloudBridgeLogic.h`) — never hand-format the string in more than
one place. That helper is pure C++ (no Arduino/network deps), so it's unit
tested under the `native` PlatformIO env exactly like `RelayLogic`/`RfLogic`.

---

## 2. What the Device Must Do

1. **Know its `tenantId` (HOME id).** The device does not learn this on its
   own — see §4 below. Until it's set, don't connect at all (an "unbound"
   placeholder topic is worse than no connection).
2. **Connect** with a plain `WiFiClient` + `PubSubClient` (no TLS — the
   production broker is `mqtt://mqtt.iotsoft.in:1883`, plain TCP; see
   `DEVICE_INTEGRATION_GUIDE.md`'s MQTT Contract section). Use the device's
   own `deviceId` as the MQTT client id — it's already globally unique, so
   there's no separate client-id scheme to invent.
3. **Set a Last-Will** on the `lwt` topic: retained, `{"status":"offline"}`,
   QoS 1. This is what makes an ungraceful power-loss show up as offline on
   the platform without the device doing anything.
4. **Subscribe** to `.../cmd` only. Never wildcard-subscribe on real
   hardware — wildcards are a server-side concept
   (`buildDeviceTopicWildcard`), not something a single device needs.
5. **On a `cmd` message**, parse it, do the actual physical action through
   the *same* control path every other input (button, RF, local web UI)
   already uses — never a separate code path that bypasses cooldowns or
   logging that the rest of the firmware relies on — then publish an ack.
6. **Publish the ack** to `.../cmd/ack` with the delivery id echoed back, a
   real UTC timestamp (see §5 — NTP), and `status: "completed"` or
   `"failed"` (+ `errorMessage`).
7. **Reconnect on a timer, never block.** `Tick()` gets called every main
   loop iteration; if not connected, check "has it been ≥ N ms since the
   last attempt" and try once — never a blocking `while(!connected) delay()`
   loop, which would freeze the button/relay/web server too.

## 3. Command / Ack Payload Shapes

These match `DEVICE_INTEGRATION_GUIDE.md`'s "Scene Device Command Payload" /
"Scene Command Ack Payload" exactly — the platform's dispatcher
(`dispatchDeviceUiCommand` in `device.service.ts`) publishes this shape
regardless of which plugin triggered it.

Command (published by the platform to `.../cmd`):

```json
{
  "deliveryId": "dispatch-...",
  "runId": "ui-dispatch-...",
  "sceneId": "ui:unlock",
  "homeId": "home-...",
  "source": "manual",
  "requestedAt": "2026-08-20T11:30:00.000Z",
  "deviceId": "JNX-QRU-C3-A7F2",
  "pid": "JNX-QRU-C3-001",
  "command": "unlock",
  "payload": { "reason": "app" }
}
```

A device only needs `command` and `payload` — the rest is context for
platform-side bookkeeping, safe to ignore.

Ack (published by the device to `.../cmd/ack`):

```json
{
  "deliveryId": "dispatch-...",
  "deviceId": "JNX-QRU-C3-A7F2",
  "acknowledgedAt": "2026-08-20T11:30:02.000Z",
  "status": "completed",
  "errorMessage": "unlock_rejected"
}
```

`errorMessage` is only present on `"failed"`.

## 4. Binding a Device to a HOME (`tenantId`)

The full platform flow for this is the authenticated provisioning-intent API
(`DEVICE_INTEGRATION_GUIDE.md`'s "Provisioning Contract" — BLE/AP handshake,
`POST /api/v1/provisioning/register-intent` → `.../complete`) or, for a
device reached through a vendor (like QRunlock via the video-call product),
the vendor's own `POST /api/v1/public/devices/register`. Neither of those is
implemented firmware-side yet for QRunlock (`PROVISIONING.md` §9 tracks that
work) — that's a real, separate project (mutual auth, a signed intent token,
a REST round-trip during onboarding), not something to bolt onto the MQTT
bridge itself.

Until that exists, **the bridge takes `homeId` as a locally-configured
value**, the same way Wi-Fi credentials are configured today: a local HTTP
POST to the device while it's on the same network.

```
POST http://<device-ip>/api/cloud
Content-Type: application/json
X-Jenix-Local-Token: <token from GET /api/status, or Serial log on first boot>

{
  "homeId": "home-user-qrunlock-vendor-jenix-internal",
  "mqttHost": "mqtt.iotsoft.in",
  "mqttPort": 1883
}
```

The broker credential is now a **separate per-device write**, not part of
the HOME/broker bind payload:

```
POST http://<device-ip>/api/device-mqtt-credential
Content-Type: application/json
X-Jenix-Local-Token: <token>

{
  "mqttUsername": "device-specific-user-or-current-shared-user",
  "mqttPassword": "device-specific-password-or-current-shared-password",
  "activateForCloudBroker": true
}
```

**Every mutating local route now requires `X-Jenix-Local-Token`** (added
after this section was first written — see the local API auth hardening
noted in `QRUNLOCK_PROVISIONING_HANDOFF.md`). The token is generated on
first boot (`esp_random()`, persisted to NVS) and printed once to Serial;
`GET /api/status` (unauthenticated, read-only) exposes whether a token is
configured and its source (`generated`/`provisioned`) but never the raw
value — read it off Serial or set one at flash time via
`JNX_LOCAL_API_TOKEN`. `/api/cloud` also now preserves any field you omit
instead of blanking it — safe to send only the fields you're changing.
`/api/device-mqtt-credential` writes the physical unit's broker auth into
its own NVS slot, and the provisioning-session command
`set_device_mqtt_credential` writes that same slot over `/provision`.

`mqttHost`/`mqttPort` default to the production broker if omitted — only
pass them to point at a different broker (e.g. a local bench broker).

**A configured MQTT username is still required today.** The broker's
`password_file` is disabled on this listener (any password value is
accepted, so `mqttPassword` genuinely has no security function right now),
but its `acl_file` only reliably grants **publish** to a named `user`
ACL block — the plain "no username" anonymous connection can subscribe to
`jnx/#` fine but every publish from it (the device's own `status`/`cmd/ack`,
and the platform's own command dispatch) gets silently denied. This was
found and fixed live 2026-08-20 (see `/etc/mosquitto/acl` on the VPS — a
`user jenix_platform` / `topic readwrite jnx/#` block) after a real bench
test showed `cloud.connected: true` but no command ever arriving. Until
the platform ships real per-device ACLs/credentials
(`MQTT_LICENSED_DEVICE_ACCESS_PLAN.md`), the per-device credential slot
will often still contain the current shared `jenix_platform` login — but
the firmware now stores and prefers that auth in a per-device slot, ready
for real unique credentials when the broker side exists. For older bench
units that only ever saved auth through `/api/cloud`, firmware keeps a
legacy fallback to those old fields so they do not silently lose broker
access on upgrade.

Saving triggers an immediate reconnect with the new topics
(`ControlApi::SaveCloudConfig` → `CloudBridgeService::ApplyConfig`) — no
restart needed.

**This is a bench/pilot mechanism, not the final design.** The real "post-
Wi-Fi bind step" (`PROVISIONING.md` §9 item 8) should replace this
`/api/cloud` route's role as the *only* way to set `homeId`, once it exists —
at that point `/api/cloud` becomes a manual-override/diagnostics tool rather
than the primary path. Don't remove it though; a manual override is still
useful on a bench.

## 5. Real Timestamps (NTP)

`acknowledgedAt` needs a real UTC time, not device uptime. ESP32 Arduino's
built-in SNTP (`configTime()`) is all this needs — no extra library. See
`src/system/TimeUtil.h/.cpp`: `Begin()` starts sync once Wi-Fi is up,
`Synced()` reports whether it landed yet, `NowIso8601()` formats it. Until
synced, timestamps will read `1970-01-01T...` — acceptable for a few seconds
after boot, not something to build logic around.

## 6. Status/Connectivity Truthfulness

Every device in this repo has a `cloudConnected_`-shaped flag feeding its
state machine and status LED (`AppState.h`'s `CloudConnected` state). Before
this bridge existed for QRunlock, that flag was permanently hardcoded
`false` — a real, silent gap (`PROVISIONING.md` §9 item 9 called it out by
name). **Wire the real connection state into it.** Don't ship a device where
the "cloud connected" indicator is decorative.

## 7. What Doesn't Belong in the Bridge

- **Telemetry**, if the device has none to report (QRunlock doesn't — it's
  a lock, not a sensor). Don't invent a heartbeat payload just to have one;
  `status` + `lwt` already give the platform accurate online/offline state.
- **Device-specific business logic.** The bridge's job ends at "dispatch the
  parsed command into the existing `ControlApi`, then ack the result." The
  actual action (`Unlock()`, a relay toggle, whatever) lives where it always
  lived and is reachable from every other input the same way.
- **A second source of truth for the command vocabulary.** `CommandKind` in
  `CloudBridgeLogic.h` should be the only place command-name strings are
  compared — extend that enum, don't string-compare `"unlock"` again
  somewhere else.

## 8. Reuse Checklist for New Devices

- [ ] Copy `src/cloud/CloudBridgeLogic.h` and `CloudBridgeService.h/.cpp`
      as-is; only `ParseCommandKind`'s command vocabulary should change
      per device.
- [ ] Add a `CloudConfig` to `ConfigTypes.h`/`Defaults.h`/`ConfigStore` —
      copy QRunlock's HOME/broker fields (`homeId`, `mqttHost`, `mqttPort`)
      plus the legacy fallback auth fields if bench compatibility matters.
- [ ] Add `MqttDeviceCredentialConfig` to
      `ConfigTypes.h`/`Defaults.h`/`ConfigStore` for the actual per-device
      broker username/password.
- [ ] Add `SaveCloudConfig` to the device's `ControlApi` and implement it in
      the app controller, following QRunlock's `AppController::
      SaveCloudConfig` exactly.
- [ ] Add `SaveDeviceMqttCredential` to the device's `ControlApi` and
      implement it in the app controller, following QRunlock's
      `AppController::SaveDeviceMqttCredential`.
- [ ] Add a local `/api/cloud` POST route to the device's web server, same
      shape as QRunlock's.
- [ ] Add a local `/api/device-mqtt-credential` POST route to the device's
      web server for explicit per-device broker auth writes.
- [ ] Add `knolleary/PubSubClient@^2.8` to `platformio.ini` `lib_deps`.
- [ ] Wire the real connected state into whatever state machine / status LED
      the device already has — don't leave a hardcoded stub.
- [ ] Write unit tests for the device's own `ParseCommandKind` mapping and
      topic building, under the `native` env — mirror
      `test_cloud_bridge_topic_building`/`test_cloud_bridge_command_parsing`
      in `test/test_logic/test_main.cpp`.
- [ ] Validate end-to-end against a real broker before considered done: POST
      `/api/cloud` with a real `homeId`, confirm `GET /api/status`'s
      `cloud.connected` flips true, publish a real command from the
      platform (or `mosquitto_pub` against the same topic for a bench test),
      confirm the physical action happens and an ack lands on `.../cmd/ack`.

---

## 9. QRunlock Field Test Procedure (this bench unit, 2026-08-20)

Concrete, run-it-now steps for whoever has the flashed hardware. Steps 1–6
need no platform secrets at all — they only need the device and a machine
on the same Wi-Fi. Report the results (screenshots or copy-pasted output
are both fine) and stop there; step 7 (the real platform-triggered unlock)
is done from the platform side once steps 1–6 pass, not by the firmware
tester.

1. **Build + flash**: from `IOT_Device/QRunlock/`, `pio run -e
   esp32-c3-supermini -t upload`. Confirm it flashes and boots (serial
   monitor: `pio device monitor -b 115200`).
2. **Join Wi-Fi** the same way already validated on this unit (AP mode +
   `POST /api/wifi`, or whatever local method was used before — needs the
   `X-Jenix-Local-Token` header now, see §4). Confirm
   `GET http://<device-ip>/api/status` shows `wifi.connected: true` and
   note the IP.
3. **Bind to the real vendor pool HOME**:
   ```
   POST http://<device-ip>/api/cloud
   Content-Type: application/json
   X-Jenix-Local-Token: <token>

   {"homeId": "home-user-qrunlock-vendor-jenix-internal"}
   ```
   Expect `{"ok":true}`. Then set the broker auth explicitly:
   ```
   POST http://<device-ip>/api/device-mqtt-credential
   Content-Type: application/json
   X-Jenix-Local-Token: <token>

   {"mqttUsername":"jenix_platform","mqttPassword":"anything","activateForCloudBroker":true}
   ```
   Until the platform ships real per-device broker ACLs, the credential
   value will often still be the current shared `jenix_platform` login —
   what changed is that firmware now stores it in the unit's own
   device-credential slot instead of overloading `/api/cloud`.
4. **Confirm the bridge connected**: within ~5 seconds,
   `GET http://<device-ip>/api/status` → `cloud.connected` should be
   `true`, and `cloud.cmdTopic` should read
   `jnx/home-user-qrunlock-vendor-jenix-internal/JNX-QRU-C3-001/JNX-QRU-C3-<yourMAC>/cmd`.
   Also note `device.deviceId` from the same response — needed for step 7.
   If `cloud.connected` stays `false`: check the device's serial log for
   `MQTT connect failed rc=...` (outbound port 1883 to `mqtt.iotsoft.in`
   blocked by the local network is the most likely cause on a
   corporate/guest Wi-Fi).
5. **Self-test the full command loop locally** — this proves the bridge
   itself works without touching any Jenix platform secret (the
   `jenix_platform` username has no real secrecy value — see §4). Needs
   `mosquitto_pub`/`mosquitto_sub` (part of the `mosquitto-clients` package
   on most platforms). In one terminal:
   ```
   mosquitto_sub -h mqtt.iotsoft.in -p 1883 -u jenix_platform -t "jnx/home-user-qrunlock-vendor-jenix-internal/JNX-QRU-C3-001/<deviceId>/cmd/ack" -v
   ```
   In another:
   ```
   mosquitto_pub -h mqtt.iotsoft.in -p 1883 -u jenix_platform -t "jnx/home-user-qrunlock-vendor-jenix-internal/JNX-QRU-C3-001/<deviceId>/cmd" -m "{\"deliveryId\":\"bench-1\",\"command\":\"unlock\",\"payload\":{\"reason\":\"bench-test\"}}"
   ```
   Expected: the physical relay pulses immediately, and within ~1s the
   `mosquitto_sub` terminal prints an ack with `"deliveryId":"bench-1"` and
   `"status":"completed"`. Repeat immediately — a second pulse inside the
   relay's cooldown window is fine to attempt (firmware just won't re-pulse;
   `Unlock()` returns false, so expect `"status":"failed"`,
   `"errorMessage":"unlock_rejected"` on that one — that's correct
   behavior, not a bug).
6. **Report back**: deviceId from step 4, whether step 5's relay pulse and
   ack both happened, and the exact ack JSON. If anything didn't match the
   expected result, include the serial log around that moment.
7. **(Platform side, done separately once 1–6 pass)**: trigger the same
   unlock through the real QRunlock vendor API
   (`POST /api/v1/public/devices/<deviceId>/commands`) to confirm the whole
   chain — app/vendor call → Jenix → MQTT → physical relay — not just the
   device's own MQTT client. This step needs the vendor API key, which
   stays platform-side.

**Result — confirmed live 2026-08-20**: steps 1–7 all passed on this bench
unit (`JNX-QRU-C3-3B0010`). Step 5 initially failed with `cloud.connected:
true` but no command ever arriving or acking — root-caused live to the
missing `mqttUsername` (§4's correction), fixed on both the broker and this
device, then re-run clean: relay pulsed
(`relay.lastReason = "bench-test"`, serial log `Relay pulse started:
bench-test -> state ON`), ack `{"deliveryId":"bench-1",...,"status":
"completed"}` received, and the cooldown-rejected second pulse ack'd
correctly as `"status":"failed","errorMessage":"unlock_rejected"`. Step 7
(the real vendor HTTP API round trip) verified separately from the platform
side the same day — see `VPS/HANDOFF.md` Round 5.

## References

- `PROVISIONING.md` — the companion standard for how a device gets Wi-Fi in
  the first place; read that first if you're starting a new device from
  zero.
- `DEVICE_INTEGRATION_GUIDE.md` — the platform-side contract (PID, MQTT
  topic names, command/ack payload shapes, OTA) this document implements
  the device side of.
- `IOT_Device/QRunlock/RELAY_INTEGRATION_PLAN.md` — why QRunlock needed this
  bridge at all (the "one device, two platforms" decision that landed on
  "Jenix One is the only device tenant").
- `IOT_Device/Token Dispensor/firmware/src/mqtt_client.cpp` — an
  already-flashed, real-world reference for the PubSubClient
  connect/reconnect/LWT pattern (pre-dates the canonical topic freeze, so
  copy the *connection* logic from it, not its topic strings).
