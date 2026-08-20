# QRunlock — One Device, Two Platforms: Integration Options

## Status — Option A built, 2026-08-20

Originally written as a plan-only document (2026-08-19) recording what
was discovered on the VPS. As of 2026-08-20, **Option A is built and
tested**, not just decided: the vendor API (`public-device-capabilities.ts`,
`POST /api/v1/public/devices/register`, `GET /api/v1/public/devices`,
config/logs routes, all wired to QRunlock's own guarded `unlockDevice()`)
exists in `VPS/apps/api-server/src/modules/api-access/`, and
`D:\IOT Device\QRunlock\qrunlock\backend\utils\smartRelay.js` has been
rewritten to call it. Full build detail is in
`IOT_Device/QRunlock/VPS/HANDOFF.md`'s "Round 3" section and that
project's own `HANDOFF.md` §0 — this document remains the architecture
reasoning/record, not the implementation log. **Still not done**: no real
vendor pool HOME/PID/API key exist yet (see that HANDOFF's "Next
recommended steps"), so none of this is reachable in production yet.

Options B and C below are kept for the record — B was never built (dual-
stack firmware was rejected), C remains the long-term direction if
QRunlock's video-call product ever needs deeper convergence with Jenix
One than a vendor API provides.

## Executive summary

The QRunlock ESP32-C3 relay/lock hardware needs to serve **two separate
live products** that are not the same system:

1. **QRunlock (the video-call product)** — a QR-code-scan-based video
   intercom app (`qrunlock-api` on the VPS: hosts, guests, calls, QR
   codes, family invites). It has a feature to let a resident unlock the
   door from a call. It does this by calling a **separate, already-live,
   general-purpose device cloud** (see below), not by talking to the lock
   hardware itself.
2. **Jenix One** (this repo) — the platform this session has been
   building a QRunlock device *plugin* for: PID `JNX-QRU-C3-001`, its own
   device registry, its own MQTT topic scheme, its own provisioning-intent
   flow, `@jenix/qrunlock-backend`, and a real PWA screen.

These are two independent device-management stacks today. A single
physical unit's firmware can cleanly speak one MQTT protocol/identity
scheme at a time without deliberate engineering to support both — that is
the actual question behind "same firmware, same time, both platforms."

## What's actually running on the VPS (discovered 2026-08-19)

### The QRunlock video-call product

- PM2 process `qrunlock-api` (also a frontend build served via nginx —
  `/root/projects/qrunlock/qrunlock/`).
- Real product: hosts, guests, QR codes bound to hosts, call logs, family
  invites, WebRTC signaling (`socket/index.js`, `turnserver.conf`).
- Its "unlock the door" feature is a **thin HTTP client**
  (`backend/utils/smartRelay.js`) that calls a separate service using an
  API key, identifying itself as tenant `"qrunlock"`:
  ```js
  // headers sent on every relay API call:
  'x-api-key':   API_KEY,
  'x-user-id':   hostDoc._id,
  'x-user-name': hostDoc.name,
  ```
  Commands: `getDevices`, `getDevice`, `claimDevice(deviceId, name, pid)`,
  `releaseDevice`, `sendCommand(cmd)` (`on`/`off`/`inching`, with
  client-side inching dedupe/cooldown), `getConfig`/`patchConfig`,
  `getLogs`, `registerFCM` (push notifications on relay events).

### The Relay service — the real device cloud

- PM2 process `relay` (id 8, cluster mode, live 14+ days), listening on
  `127.0.0.1:3002` (`RELAY_API_URL=http://154.61.69.200:3002` is what
  `qrunlock-api` points at). Source at `/root/projects/relay/` — compiled
  TypeScript (`dist/`), Prisma + SQLite (`relay.db`), an MQTT bridge.
- **Multi-tenant by design already.** Prisma schema comment on
  `AppTenant`: *"One record per parent project (qrunlock, feeflow, future
  devs)."* Each tenant has its own hashed API key. This service was built
  to be shared across products from day one — QRunlock (video call) is
  just its first real tenant.
- **Device model** (`prisma/schema.prisma`):
  - `deviceId` — 12-char MAC hex (e.g. `E072A16D33C8`), globally unique,
    **not** scoped to a tenant until claimed — auto-created on first MQTT
    heartbeat.
  - `pid` — defaults to `"RLY1"`. A completely different PID convention
    from Jenix's own (`JNX-QRU-C3-001`, `JNX-TG-C3-201`, etc.) — same
    concept, different namespace, no relationship between the two today.
  - `sr` — a serial format `RLY2-YYYYMMDD-MACADDRESS`.
  - `relayConfig` (JSON): `buttonMode`, `powerPref`, `timerDuration`,
    `inchingDuration`, `rfEnabled`, `maxOnDuration`.
  - `dsConfig` (JSON): door-sensor/interlink settings.
- **Ownership is per-tenant, not global**: `DeviceOwnership` is keyed
  `(deviceId, appId, ownerUserId)` — the schema already supports the same
  physical `deviceId` being claimed independently under different
  `appId`s. Nothing in the data model prevents a second tenant from
  claiming the same device the video-call app already claimed.
- **Sharing model**: `DeviceMember`/`Group`/`InvitationCode` — family
  sharing, UUID invite codes, 30-minute expiry, one-use. Structurally the
  same shape as Jenix One's own HOME membership/sharing model, built
  independently.
- **Operation log** (`OperationLog`/`LogArchive`): capped at 100/device/
  tenant, `source` enum is `app | button | ds_interlink | timer |
  inching | schedule | rf_remote | mqtt` — almost exactly the activity
  feed I just built for `@jenix/qrunlock-backend`'s `activity` module,
  arrived at independently.
- **OTA**: `OTAFirmware` keyed `(pid, version)`, same shape as Jenix's own
  OTA release model.
- **MQTT wire protocol** (`dist/mqtt/bridge.js`, `dist/mqtt/protocol.js`):
  ```
  device subscribes:  relay/{deviceId}/cmd
  device publishes:   relay/{deviceId}/state
                       relay/{deviceId}/heartbeat
                       relay/{deviceId}/sensor
                       relay/{deviceId}/rf
                       relay/{deviceId}/disown
  ```
  Commands normalize to `{ cmd, duration?, enabled?, from? }` —
  `on`/`off`/`inching`/`timer_start`/`timer_stop`. This is a flat,
  simple, already-working protocol real hardware speaks today.

### Jenix One's own scheme, for comparison

From `DEVICE_INTEGRATION_GUIDE.md` and this session's
`@jenix/qrunlock-backend`:
```
device subscribes:  MQTT_DEVICE_COMMAND_TOPIC (jenix/runtime/commands)
                     MQTT_OTA_REQUEST_TOPIC
device publishes:   jenix/runtime/telemetry
                     MQTT_DEVICE_COMMAND_ACK_TOPIC
                     MQTT_OTA_ACK_TOPIC
```
PID `JNX-QRU-C3-001`, deviceId convention `JNX-QRU-C3-{suffix}`, HOME-
based ownership/sharing, provisioning via BLE/SoftAP + a
provisioning-intent HTTPS flow (`PROVISIONING.md`).

**Side by side:**

| | Relay service (video-call product) | Jenix One |
|---|---|---|
| Device identity | 12-char MAC hex | `JNX-QRU-C3-{suffix}` |
| PID | `RLY1` | `JNX-QRU-C3-001` |
| MQTT topics | `relay/{deviceId}/*` | `jenix/runtime/*` |
| Ownership | `(deviceId, appId, ownerUserId)` | HOME membership |
| Data store | SQLite/Prisma, own box | MongoDB (optional), shared platform |
| Sharing | Groups + invite codes | HOME roles |
| Status | **Live, real devices claimed today** | Built, not yet issued a PID or deployed |

## The real problem

Firmware can only be one MQTT client with one identity at a time without
deliberate extra engineering. "Same firmware works on both" is not free —
it means one of:

- the firmware picks one protocol and the *other* platform accesses the
  device indirectly (through the platform that owns the device), or
- the firmware genuinely speaks both protocols/connections at once, or
- the two platforms converge onto one protocol over time.

## Options

### Option A — Jenix One becomes a second Relay tenant (reuse, don't duplicate)

Jenix One registers as a second `AppTenant` (e.g. `appId: "jenix-one"`)
of the already-live Relay service, the same way `qrunlock-api` is today.
Firmware keeps speaking exactly one protocol — `relay/{deviceId}/*` to
the Relay broker — regardless of which app is controlling it. Jenix One's
`@jenix/qrunlock-backend` would stop running its own parallel MQTT device
registry for this product and instead become a thin HTTP proxy to the
Relay API (`getDevices`/`claimDevice`/`sendCommand`/`getConfig`/
`getLogs`), the same shape `smartRelay.js` already is for the video-call
app.

**Why this is the strongest option on paper**: the schema already
supports it (`(deviceId, appId, ownerUserId)` ownership is exactly
designed for a device to be claimed by more than one parent app), it's
zero new firmware protocol work, and it reuses a service that's already
running real devices in production rather than standing up a second one.
Jenix One's PID/UI layer (icon, dashboard, the padlock screen already
built) sits on top as the presentation layer; the Relay service remains
the actual device-connectivity layer.

**What it would cost**: `@jenix/qrunlock-backend`'s `lock`/`rf-learning`/
`settings`/`activity` modules (already built and tested this session)
would be rewritten to proxy Relay API calls instead of dispatching
through Jenix's own `dispatchDeviceUiCommand`/MQTT runtime — real rework,
not just config. Jenix's device registry/PID/OTA/scenes would need a
"backed by an external device cloud" concept that doesn't exist yet
(today every Jenix device is assumed to be a first-party MQTT client of
Jenix's own broker). Cross-service auth (Jenix backend holding a Relay
API key) and failure-mode handling (what happens to the ONE app's screen
if the Relay service is down) both need real design.

### Option B — Dual-stack firmware

Firmware maintains two independent identities/connections at once: one
to the Relay broker (`relay/{deviceId}/*`, serving the video-call app)
and one to Jenix's own broker (`jenix/runtime/*`, provisioning-intent
flow, serving the ONE app). Both stay exactly as they are today; no
service is rewritten.

**Cost**: real flash/RAM/connection overhead on an ESP32-C3 (two MQTT
clients, two reconnect/backoff loops, two credential sets to provision
and store). More seriously: **two independent sources of truth for the
same relay**. If the ONE app fires `unlock` at the same moment the
video-call app does, or if one platform thinks the door is locked while
the other just unlocked it, there is no single authority reconciling
state — a real correctness risk for a physical door lock, not just a UX
inconsistency. Whoever picks this option needs an explicit answer for
"which system's state wins" before it ships.

### Option C — Migrate the video-call app onto Jenix One

Retire the standalone Relay service over time; make the video-call app a
licensed third-party consumer of Jenix One's own public device API
instead. This is exactly what
[`MQTT_LICENSED_DEVICE_ACCESS_PLAN.md`](../../MQTT_LICENSED_DEVICE_ACCESS_PLAN.md)
already describes as **"Phase E — Third-Party Vendor Access"** — vendor
accounts, billing plans, licensed device access, already designed as a
future capability of Jenix One, just never connected to this specific
real use case before now.

**Why this is the cleanest long-term architecture**: one device cloud,
one MQTT protocol, one PID system, one place billing/entitlements live.
It also turns "QRunlock video-call app" into a proof-of-concept for
Jenix's own third-party vendor story, which the licensing plan already
wants to build.

**Why it's not a today/tomorrow task**: `qrunlock-api` is a real,
independently live product with real registered hosts, real claimed
devices, real call history. Migrating its device layer means either a
data migration (Relay's SQLite `Device`/`DeviceOwnership`/`Group` records
→ Jenix's device/HOME model) or a long dual-write bridge period. This is
a genuine project, not a config change — realistically sequenced *after*
Phase A–D of the licensing plan exist (broker hardening, per-device
credentials, signed licenses, token issuance), none of which are built
yet (`MQTT_LICENSED_DEVICE_ACCESS_PLAN.md` "Current Status": *"No broker
hardening, no license service, and no token service are implemented."*).

## Open questions that decide this, not engineering ones

- **Business/brand relationship**: is "QRunlock" (video call) meant to
  stay its own product long-term, or fold into Jenix One eventually? That
  answer picks between Option A (stays separate, integrates) and Option C
  (converges).
- **Who owns the lock hardware relationship** — does a customer buy a
  QRunlock lock *through* the video-call product, through Jenix One, or
  both? This decides whether dual-claim (Option A) is even a real
  scenario or a edge case.
- **Tolerance for the state-conflict risk in Option B** — is dual-stack
  firmware acceptable if only one platform is ever actively used per
  customer at a time (making conflicts rare in practice), or is that too
  risky for a physical door lock regardless of likelihood?

## Recommendation (non-binding — see Status above)

Option A first, with Option C as the deliberate long-term direction
already implied by the licensing plan. Reasoning: it's the only option
that adds zero new firmware protocol surface, reuses a service that's
already correctly handling real production devices today, and doesn't
require touching `qrunlock-api` (the live video-call product) at all —
all the new work is on Jenix One's side, isolated to
`@jenix/qrunlock-backend`. Option B is not recommended for a physical
lock given the state-conflict problem has no clean answer. Option C is
the right eventual destination but has real prerequisites (the licensing
plan's Phase A–D) that don't exist yet.

## Firmware changes required to speak the Relay service's protocol directly

Checked against the actual firmware in `IOT_Device/QRunlock/src/` on
2026-08-20. One fact makes this simpler than it could have been: **the
firmware has no cloud/MQTT connectivity at all today** — only BLE/SoftAP
provisioning (`BleProvisioningService`), a local web server
(`WebServerService`, per `doc.md`), and local relay/RF control. So this
is new work, not a rework of something that already talks to a different
broker.

### Already compatible, no change needed

- `device_identity/DeviceIdentity.cpp` already computes `hardwareId_` —
  `%012llX` of the 48-bit efuse MAC, i.e. a 12-char uppercase hex string
  (e.g. `E072A16D33C8`) — **exactly** the Relay service's `deviceId`
  format. The Jenix-prefixed `deviceId_` (`JNX-QRU-C3-{macSuffix}`) is a
  separate field computed alongside it; talking to the Relay service just
  means using `hardwareId_` as the MQTT identity/topic key instead.

### New firmware work

1. **Add an MQTT client dependency.** `platformio.ini`'s `lib_deps` today
   is only `ArduinoJson` + `NimBLE-Arduino` — no MQTT library at all.
   Needs one (e.g. PubSubClient), plus TLS support if the broker requires
   it (unconfirmed — see "Needed from you" below).
2. **New `RelayMqttService` module**, same pattern as the existing
   `OtaService`/`WifiManager`: connect once Wi-Fi is up, reconnect with
   backoff on drop, subscribe `relay/{hardwareId}/cmd`.
3. **Command handling** for the normalized payload shape
   (`{cmd, duration?, enabled?, from?}`):
   - `cmd:"inching"` → the natural fit — call the existing momentary-pulse
     path (`ControlApi::Unlock`/`RelayService`), using `duration` if
     given else the configured `relayPulseMs`.
   - `cmd:"on"`/`"off"` → **not a clean fit today.** `RelayLogic`/
     `RelayService` are pulse-only, self-resetting — there's no
     hold-open/hold-closed relay state to set. Needs a decision: does the
     door-lock use case need literal on/off at all, or is `inching` the
     only command this product ever receives? If on/off is required,
     that's new relay-state-holding logic, not just wiring.
   - `cmd:"timer_start"`/`"timer_stop"` → firmware has no timer/schedule
     concept today; this is new.
4. **Outgoing publishes**:
   - `.../state` — `{relay, state, timer_active, timer_remaining,
     online}` per `normalizeStatePayload`, after every relay action.
   - `.../heartbeat` — periodic; likely needs rssi/fw version/uptime,
     since `Device.rssi`/`fw`/`lastSeen`/`isOnline` all exist server-side.
     Interval not confirmed.
   - `.../rf` — wire the existing `RfService`'s remote-triggered event
     into a publish here.
   - `.../disown` — publish from `ControlApi::FactoryReset()` so the
     server releases ownership when the device is locally reset.
5. **Config fields + apply loop.** `config/ConfigTypes.h`'s
   `DeviceConfig` struct has `relayPulseMs`/`relayCooldownMs`/OTA fields
   only — no `buttonMode`, `powerPref`, `timerDuration`,
   `inchingDuration`, or `rfEnabled`. All five need adding to the struct,
   `ConfigStore` persistence, and an apply-on-receipt handler. **Note:**
   this is the identical gap already flagged in
   `IOT_Device/QRunlock/VPS/HANDOFF.md`'s "Known limits" for the Jenix
   One integration — building it once serves either path.

### Needed from you before this can actually be built

- The Relay broker's actual connection details (host/port, TLS or not,
  per-device or shared credentials) — not something to pull from `.env`
  without you present.
- Whether RF-learn needs to be a *remote-triggerable* command. The
  confirmed normalized command set is only `on/off/inching/timer_start/
  timer_stop` — no RF-learn trigger seen in `dist/mqtt/protocol.js`.
  `routes/relay.js`/`routes/devices.js` weren't fully read for this — if
  the video-call app needs a "start pairing" button, that may need a new
  server-side command too, not just firmware.
- Confirmation on the on/off question in point 3 above.

### The payoff, if Option A is chosen later

This exact firmware change set is what "same firmware, both platforms"
actually requires — and notably, **it's the only side that needs to
change**. If Jenix One later becomes a second Relay tenant (Option A
above), Jenix One's backend talks to the Relay HTTP API server-side,
the same way `qrunlock-api`'s `smartRelay.js` does — never to the device
directly. No additional device-side identity, topic, or protocol work
would be needed for the Jenix One side at all.

## Decided (2026-08-20): single platform, no dual-tenant compromise

Confirmed by the platform owner: Jenix One is to be the **only** relay/
device tenant on this VPS — the standalone Relay service was an earlier
plan, since superseded by the Tuya-style single-platform direction
(`PLATFORM_ARCHITECTURE_AND_ROLES.md`). Other specific projects (like the
QRunlock video-call app) reach devices through a server-to-server link to
Jenix One, not through their own device stack.

This is now materially easier than "Option C" above assumed, because
**QRunlock (video-call) currently has zero real relay users** — there is
no `DeviceOwnership`/`Group`/`Device` data on the standalone Relay service
tied to a real customer to migrate. There is nothing to lose by not
reusing it. Recommendation A (dual-tenant reuse) is withdrawn — go
straight to what was Option C, without the migration cost that made it a
"not today" project. The old Relay service (`/root/projects/relay`) is
left running, unused, no urgency to decommission — zero risk either way.

Firmware needs no Relay-protocol work at all (the "Firmware changes
required to speak the Relay service's protocol directly" section above is
now a documented dead end, kept for reference only). Firmware keeps
targeting Jenix One's own scheme exactly as already built.

### QRunlock is inching-only — confirmed 2026-08-20

QRunlock never needs on/off — it's a RIM-lock power supply (see
`ProductIdentity.h`'s `kProductCategory`/`kProductLine`, added
2026-08-20), which only ever needs a momentary release pulse. This
resolves the open on/off question cleanly: `@jenix/qrunlock-backend`'s
`unlock` action (already inching-only by construction — see
`lock/lock.service.ts`) was already the right shape; no redesign needed.

### Guarded path, explicit caller tag — implemented 2026-08-20

`lock.service.ts`'s `unlockDevice()` now takes an explicit `caller`
parameter, set by the calling code path (never by request body — a
client cannot claim to be someone else). The PWA's own HTTP controller
passes `"app"`. A future vendor/public-API path for the QRunlock
video-call product must call this exact function directly — never
bypass it with a raw device-command dispatch — and pass its own fixed
string (e.g. `"api:qrunlock"`). The activity log's `source` field now
always reflects the true caller instead of an inferred guess.

### Is API-key + PID scoping safe enough for the next 10 years?

**Short answer: the API-key model itself is fine long-term — this is
literally how most durable B2B APIs still work (Stripe, Twilio, etc. use
long-lived bearer keys plus scoping/expiry/audit, not something more
exotic). What's missing today is one load-bearing gap, cheap to close
now while there are zero real users, expensive to retrofit later.**

**The gap**: `VPS/apps/api-server/src/modules/api-access/` scopes an
`ApiKey` to an `ApiPackage`, and a package to one `pid` — but there is no
check that a specific `deviceId` is actually bound to that vendor. As
built today, a valid QRunlock-package key could call
`POST /api/v1/public/devices/:deviceId/commands` for **any** device of
PID `JNX-QRU-C3-001`, not just devices the QRunlock video-call product's
own hosts actually claimed. For most products that's a data-scoping bug;
for a door lock it's a physical blast-radius problem — a single leaked
key would expose every QRunlock-equipped door on the platform, not just
the leaking vendor's own customers.

**Recommended before any real vendor traffic** (do this now — free while
there are no users, real engineering effort to retrofit once there are):

1. Add an explicit device↔vendor binding record (`deviceId` +
   `packageId`, analogous to the standalone Relay service's own
   `DeviceOwnership(deviceId, appId, ownerUserId)` — worth borrowing that
   design even though the service itself isn't being reused). A command
   is only accepted if the device is bound to the calling package, not
   merely PID-matched. This is the one gap worth insisting on before
   launch.
2. Make key expiry mandatory (`expiresAt` is optional on
   `CreateApiKeyInput` today) for any package granting device-command
   scopes, with a real rotation procedure documented.
3. Confirm `rateLimitPerMinute` is actually enforced, not just stored —
   unverified as of this document.
4. Give every vendor package its own `source` tag
   (`api:{packageId}`) in the activity log, following the same
   explicit-caller convention just added to `unlockDevice()` — a
   misbehaving or compromised vendor key should be immediately traceable
   without cross-referencing anything else.

**Not recommended right now**: jumping straight to the full signed-
license-manifest / device-keypair / short-lived-token model from
`MQTT_LICENSED_DEVICE_ACCESS_PLAN.md`. That document is the right target
for **first-party device → MQTT broker** trust (a different layer — the
physical device's own identity), and for a future where truly external,
not-owned-by-you vendors want in. For QRunlock (a product you own,
calling a platform you own), that much machinery is disproportionate
today. The four items above close the actual gap; a short-lived-token
upgrade for the HTTP vendor path can layer on top later without a
redesign, once (if ever) this platform sells access to real third
parties.

## What this document does not do

- It does not change any code.
- It does not touch the live Relay service, `qrunlock-api`, or their
  data — everything above was gathered read-only.
- It does not commit Jenix One to Option A, B, or C.
