# Jenix One — Device Provisioning Standard

**Applies to:** every current and future Jenix One device (Tank Guard, Nurse
Call Receiver, Smart RF Bridge, Token Dispenser, P10 Display, SOS Siren,
Smart Streamer, and anything that ships after this document).
**Status:** this is the standard. Not a draft, not a "v1" awaiting a later
hardening pass — this is the professional, secure, production configuration
every device implements from here on.

---

## Executive Summary

Provisioning is the moment a phone hands a brand-new device its home Wi-Fi
credentials. Get it wrong and either the device is unreliable to set up, or
it's an open door — an unauthenticated BLE credential exchange means any
phone within range of an unconfigured device can read or inject Wi-Fi
passwords.

Rather than design a new protocol for this, Jenix One adopts **Espressif's
own official Wi-Fi Provisioning framework** — the same `wifi_provisioning` /
`protocomm` component built into ESP-IDF, the manufacturer's SDK for the
exact chips every Jenix device runs on. This is not a third-party library or
a convenience wrapper; it is core, permanent infrastructure that Espressif
itself maintains and recommends for production use. Every Jenix device is an
Espressif chip, so this is the manufacturer's own answer to "how do I
provision this chip securely," not an outside opinion.

What this buys us:

- **Mutual, authenticated encryption**, not a plaintext credential exchange.
  The phone and the device each prove they hold a shared secret (the
  device's Proof-of-Possession, printed on its label or bound at
  manufacturing) before any Wi-Fi credential is ever sent, using the same
  SRP6a key-exchange method (RFC 5054) used in mainstream authenticated
  protocols, followed by AES-256-GCM for the credential exchange itself.
  Nobody who doesn't already have the device's PoP can read or forge that
  exchange, even if they're within Bluetooth range.
- **One implementation, every device.** Tank Guard, the Nurse Call Receiver,
  the RF Bridge, the Token Dispenser, the P10 Display, the SOS Siren, and the
  Smart Streamer all speak the identical protocol. A firmware engineer who
  has implemented it once has implemented it for the whole product line.
- **Maintained by the chip vendor, not by us.** This is the same guarantee
  every other ESP32-based commercial product in the world relies on. It
  isn't going anywhere in 10 years because Espressif's own SDK depends on it
  continuing to exist.
- **The phone app already speaks this protocol.** No app-side surprises —
  the existing "tap + to add a device" flow, the radar scan animation, the
  Wi-Fi credential screen, all stay exactly as they are. Only what happens
  underneath, between phone and device, changed.

---

## 1. Architecture

Two layers, both part of ESP-IDF:

- **`protocomm`** — the transport- and security-agnostic base layer. It
  defines how a phone and a device establish an encrypted session and
  exchange request/response messages, independent of whether the link is
  Bluetooth or Wi-Fi.
- **`wifi_provisioning`** — built on top of `protocomm`, defines the actual
  Wi-Fi commands (scan for networks, submit credentials, check connection
  status) that flow through that encrypted session.

**Transports** (`protocomm` supports both; every Jenix device implements
both, matching the app's existing two-path flow):
- **BLE** — GATT-based. Service UUID `021a9004-0382-4aea-bff4-6b3f1c5adfb4`.
  Individual endpoints ("prov-session", "prov-scan", "prov-config") are
  exposed as separate characteristics, discovered by name rather than a
  hardcoded UUID per endpoint — this is Espressif's own design, and it means
  neither the app nor the firmware has to keep a manually-maintained table
  of characteristic UUIDs in sync.
- **SoftAP** — the device opens its own Wi-Fi hotspot and runs a small local
  HTTP server; the phone connects to it and exchanges the same protocol
  messages as HTTP POST/response bodies. Used when BLE isn't available on
  the phone.

**Security**: `protocomm` offers three schemes. Jenix One devices use
**Security Scheme 2**:

| Scheme | Key exchange | Session encryption | Use |
|---|---|---|---|
| 0 | none | none (plaintext) | never — not used on any Jenix device |
| 1 | Curve25519 (X25519) | AES-256-CTR | acceptable fallback, not our default |
| **2** | **SRP6a (RFC 5054)** | **AES-256-GCM** | **the Jenix One standard** |

Espressif's own guidance: Security Scheme 2 "offers stronger authentication
via SRP6a and is recommended for production." That's not our opinion — it's
the chip manufacturer's current, written recommendation, which is exactly
why we're using it rather than inventing our own judgment call.

**Message format**: every message on the wire is a **Protobuf** (Google
Protocol Buffers) payload — compact, versioned, and extensible without
breaking older devices or app versions. The exact schemas are Espressif's
own, defined in the `esp-idf` repository:
- `components/protocomm/proto/constants.proto`
- `components/protocomm/proto/session.proto`
- `components/protocomm/proto/sec2.proto` (the security handshake)
- `components/wifi_provisioning/proto/wifi_constants.proto`
- `components/wifi_provisioning/proto/wifi_config.proto` (credential exchange)
- `components/wifi_provisioning/proto/wifi_scan.proto` (network scan)

Firmware and app both build against these exact files — nobody hand-writes
or reinterprets the wire format.

---

## 2. Device Naming Convention

Unchanged from before — this is just the BLE advertising name, unrelated to
the security layer above:

```
JNX + {2-4 letter product code} + {last 6 hex digits of Wi-Fi STA MAC, uppercase}
```

| Product | Code | Example (MAC ...BA:F9:68) |
|---|---|---|
| Tank Guard | `TG` | `JNXTGBAF968` |
| Nurse Call Receiver | `NC` | `JNXNCBAF968` |
| Smart RF Bridge | `RF` | `JNXRFBAF968` |
| Token Dispenser | `TD` | `JNXTDBAF968` |
| P10 Display | `P10` | `JNXP10BAF968` |
| SOS Siren | `SOS` | `JNXSOSBAF968` |
| Smart Streamer | `SS` | `JNXSSBAF968` |
| Smart School Bell | `SB` | `JNXSBBAF968` |

---

## 3. The Provisioning Flow

### Phase 0 — First Boot
```
Device starts
  └─ NVS has Wi-Fi credentials already?
       ├─ YES → connect directly, skip provisioning entirely
       └─ NO  → start the wifi_provisioning manager (Phase 1)
```

### Phase 1 — Advertise
Device starts BLE advertising as `JNX{ProductCode}{6-hex-MAC}` and/or opens
its SoftAP hotspot of the same name, and starts the `wifi_provisioning`
manager configured for Security Scheme 2.

### Phase 2 — Secure Session Establishment (SRP6a)
Before any Wi-Fi credential is exchanged, phone and device authenticate each
other and derive a shared session key, using the device's Proof-of-Possession
(a per-device secret, provisioned at manufacturing — see Section 6):

```
Phone -> Device:  client_username, client_pubkey        (Sec2SessionCmd0)
Device -> Phone:  device_pubkey, device_salt             (Sec2SessionResp0)
Phone -> Device:  client_proof                           (Sec2SessionCmd1)
Device -> Phone:  device_proof, device_nonce              (Sec2SessionResp1)
```

Both sides now hold the same session key without it ever having crossed the
wire. Every message from here on is AES-256-GCM encrypted with that key. A
phone that doesn't know the device's Proof-of-Possession cannot complete this
exchange, cannot derive the session key, and cannot read or inject anything
into the credential exchange that follows — this is what closes the "any
nearby phone can provision the device" gap.

### Phase 3 — Wi-Fi Credential Exchange (inside the encrypted session)
```
Phone -> Device:  CmdScanStart                    -> device scans nearby networks
Phone -> Device:  CmdScanStatus / CmdScanResult    -> phone lists them for the user
Phone -> Device:  CmdSetConfig { ssid, passphrase } -> device stores credentials
Phone -> Device:  CmdApplyConfig                    -> device connects
Phone -> Device:  CmdGetStatus  (polled)            -> connected / connecting / failed
```
Once `RespGetStatus` reports the device connected, provisioning is done. The
phone disconnects. **That is the full scope of provisioning** — see Section 4.

### Phase 4 — Everything After Wi-Fi Is the Device's Own Job
Connecting to the Jenix VPS over MQTT happens on the device's own, over its
new Wi-Fi link, independent of the phone or the provisioning session, which
has already ended. Neither BLE nor SoftAP has any further role. The device
simply becomes visible on the dashboard once MQTT connects.

---

## 4. Scope — On Purpose, Not by Omission

Provisioning's only job is Phase 1 through Phase 3 above: authenticate,
establish an encrypted session, hand over Wi-Fi credentials, confirm the
device joined the network. It does not manage MQTT, does not manage home/
tenant binding, and does not stay open a moment longer than it needs to.
Home/tenant binding happens after the device is online, through the existing
platform provisioning-intent API — a separate, ordinary authenticated REST
call, not something layered onto the BLE session.

---

## 5. App Side

Already built: the "+" button on the Devices page, the animated radar scan,
the Wi-Fi credential form, the progress screens
(`PWA_APK/apps/web-pwa/src/features/provisioning/`).

**Correction, 2026-08-27**: this section previously claimed the app "now
speaks the real `protocomm`/`wifi_provisioning` protocol... instead of a
custom scheme." That was aspirational, not actual — verified false by
reading the current code. `bleDiscoveryService.ts`/`bleProtocol.ts`/
`bleProvisioningService.ts` still implement only the original custom scheme
(plain JSON `{cmd:"hello"}` / `{cmd:"set_wifi",...}` over a simple GATT
characteristic, no SRP6a, no Protobuf, no encryption), and that scheme is
additionally hardcoded to Tank Guard's PID/naming, not generic across
products. See Section 10 for the concrete gap list and recommended
implementation path — this is real, unstarted work, not a rounding error.

---

## 6. What Firmware Needs to Do

For each device:

1. Enable the `wifi_provisioning` component, configured for **Security
   Scheme 2**, with both the **BLE** and **SoftAP** transports registered.
2. Set the BLE advertised name / SoftAP SSID to `JNX{ProductCode}{6-hex-MAC}`
   per Section 2.
3. Assign a **per-device Proof-of-Possession** at manufacturing/flashing time
   (not a single shared secret across the whole product line) — this is what
   the SRP6a handshake authenticates against. Espressif's tooling supports
   generating and burning these per unit; treat it the same as any other
   per-device credential (MAC address, serial number).
4. On credential-set success, save to NVS and connect — no different from
   before.

This applies identically whether the device is built with PlatformIO +
Arduino (the current build for six of the seven devices) or native ESP-IDF
(Smart Streamer). `wifi_provisioning` is an ESP-IDF component either way;
PlatformIO's `espressif32` platform supports mixing `framework = arduino,
espidf` in `platformio.ini` specifically for calling ESP-IDF components like
this one from an otherwise-Arduino sketch.

**Recommended rollout order**: pilot on **Tank Guard** first — validate the
BLE + SoftAP + Security2 flow works reliably against real hardware and the
app, end to end, before rolling out to the rest of the fleet. This is
ordinary engineering discipline (prove it once, then repeat it six times),
not a staged/partial version of the standard — every device converges on the
identical configuration described in this document.

---

## 7. Fleet Status

| Device | Chip | Build | Provisioning status |
|---|---|---|---|
| Tank Guard | ESP32-C3 | PlatformIO + Arduino | pending, after Token Dispenser pilot validates |
| Nurse Call Receiver | ESP32-C3 | PlatformIO + Arduino | pending, after pilot validates |
| Smart RF Bridge | ESP32-C3 | PlatformIO + Arduino | pending |
| Token Dispenser | ESP32-C3 | PlatformIO + Arduino | **active pilot** — implementing now, see notes below |
| P10 Display | ESP32-C3 | PlatformIO + Arduino | pending |
| SOS Siren | ESP32-C3 | PlatformIO + Arduino | pending — no BLE stack exists yet, clean implementation |
| Smart Streamer | ESP32-P4 | native ESP-IDF | pending — simplest integration, already native ESP-IDF |
| Smart School Bell | ESP32-S3 | native ESP-IDF | in progress — shared `jenix_provisioning` component built here first (Section 8a), BLE Security Scheme 2 live on real hardware 2026-09-12 (advertises `JNXSB{mac}`, Security Scheme 2 session ready) in a new `esp32-s3-schoolbell-prov` env; actual phone/app pairing, SoftAP scheme, and platform bind still open; see Section 11 and School Bell's own `HANDOFF.md` |

**Token Dispenser pilot notes** — the Token Dispenser (not Tank Guard) became
the de facto pilot, implemented in a separate `jenix-td-c3-prov2` PlatformIO
environment (mixed `framework = arduino, espidf`, own partition table) so the
tested, currently-shipping `jenix-td-c3` build is never touched while this
validates on hardware. Two deliberate, called-out deviations from the letter
of this standard during the pilot phase, both scoped to be revisited once
validated:

- **BLE transport only for now** — the 4MB flash chip didn't have headroom
  left for both BLE and SoftAP transports plus the rest of the existing
  firmware. SoftAP is a planned follow-up once the BLE + Security2 path is
  proven on real hardware and the real flash cost is known.
- **Auto-generated Proof-of-Possession** — Section 6 calls for a PoP assigned
  at manufacturing/flashing time via Espressif's tooling. No manufacturing
  pipeline for that exists yet, so the pilot firmware generates a random PoP
  on first boot, persists it to NVS, and prints it to Serial + the event log
  for bench testing. A real manufacturing-time burn step is still needed
  before this ships to the field.

---

## 8. Reuse Checklist for New Devices

- [ ] Product code chosen and added to Section 2 (2-4 letters, no clash)
- [ ] `wifi_provisioning` enabled with Security Scheme 2, BLE + SoftAP
      transports both registered
- [ ] Unique per-device Proof-of-Possession assigned at manufacturing
- [ ] BLE/SoftAP name follows `JNX{code}{6-hex-MAC}`
- [ ] Home/tenant binding happens after Wi-Fi connects, through the platform
      API — never inside the provisioning session itself
- [ ] Validated end-to-end against the app before considered done

---

## 8a. Build This Once, As a Shared Component — Not Per-Device Copies

Every device on Section 7's fleet table needs the *identical* BLE +
SoftAP + Security-Scheme-2 + PoP + platform-bind implementation. Left
unmanaged, "implement provisioning for device X" naturally turns into
"copy QRunlock's `BleProvisioningService.*`, tweak the product code, paste
into device X's tree" — which is exactly how the platform ended up with
per-device bespoke contracts elsewhere (see
`IOT_Device/Smat Token Dispensor/QRUNLOCK_PARITY_MASTER_PROMPT.md`'s
opening paragraph for the real cost that pattern already caused once, on
the MQTT bridge side). Provisioning must not repeat that mistake.

**Requirement**: the first device to implement this after QRunlock's pilot
(School Bell, Section 11, or whichever lands first) must extract the
provisioning implementation into one shared, product-agnostic component —
e.g. `IOT_Device/_shared/jenix_provisioning/` — parameterized only by:

- product code (Section 2)
- PID
- a PoP source (manufacturing-burned value, or the first-boot-generate/
  persist-to-NVS fallback used during pilots)
- the platform bind endpoint/credentials (Section 3 Phase 4 / Section 6
  item 8's claim flow)

QRunlock's own `src/connectivity/BleProvisioningService.*` should then be
refactored to consume that shared component instead of staying a
device-local implementation — QRunlock becomes the first *consumer* of the
shared code, not a permanently-separate original. Every device after that
(native ESP-IDF or `framework = arduino, espidf`) adds itself by supplying
those four parameters, not by copying and adapting source files. If a
device's build system genuinely cannot reference an external shared
component (e.g. an isolated PlatformIO env with its own toolchain
constraints), document that specific, concrete limitation in that device's
own delta section rather than defaulting to a copy for convenience.

This section itself should stop growing a new "Device X Firmware Delta"
copy-paste block every time a device is migrated, once the shared
component exists — future device delta sections should be short: "adopt
`jenix_provisioning`, supply {product code, PID, PoP source, bind
endpoint}, note any device-specific deviation," not a re-derivation of
Sections 1-6 per device the way Sections 9 and 11 currently are (written
before this requirement existed).

**Status, 2026-09-11**: built. `IOT_Device/_shared/jenix_provisioning/`
exists (see its own `README.md`), parameterized by product code, PID, and
a PoP source exactly as specified above (no `bind_endpoint` parameter yet —
that platform-side contract doesn't exist anywhere in this repo as of this
writing; see Section 11's status note). School Bell (Section 11) is its
first consumer, BLE scheme only so far, confirmed live on real hardware
2026-09-12 (see School Bell's own `HANDOFF.md`). QRunlock's own `BleProvisioningService.*` has **not**
been refactored onto it yet — deferred pending School Bell's hardware
validation, since QRunlock's `esp32-c3-supermini-prov2` env has its own
unresolved Arduino/ESP-IDF-5.3.1 build wall (Section 9) that's orthogonal
to this and risky to touch blind.

---

## 9. QRunlock Firmware Delta To Reach This Standard

This section is the direct gap list for the current `QRunlock` firmware.

### Current QRunlock status

- The current firmware uses a custom local provisioning flow:
  - SoftAP recovery and setup through local HTTP routes such as
    `/api/status`, `/api/provisioning`, and `/api/wifi`
  - a custom `WifiManager` for storing credentials and joining Wi-Fi
  - a custom BLE provisioning service, currently disabled in the latest
    bench firmware because BLE startup on this ESP32-C3 build was unstable
- Recovery behavior is already good and should be kept:
  - failed Wi-Fi falls back to AP mode
  - 10 quick button presses clear Wi-Fi and force AP mode
  - 30-second button hold also clears Wi-Fi and forces AP mode
- Device identity is now compliant with the provisioning naming convention:
  - current AP/BLE name format is `JNXQRU` plus the last 6 uppercase hex
    digits of the STA MAC, with no separators
- Provisioning migration groundwork landed 2026-08-20:
  - separate `esp32-c3-supermini-prov2` PlatformIO env added with
    `framework = arduino, espidf`
  - dedicated `partitions_prov2.csv` added (single app slot + `coredump`)
  - `sdkconfig.defaults` added for Security Scheme 2 / NimBLE / mixed
    Arduino+ESP-IDF operation
  - per-device Proof-of-Possession now generates once on first boot if
    absent, persists to NVS, and prints to Serial for bench use
  - as of 2026-08-21, the old `Couldn't find the main target of the project!`
    blocker is resolved, and the old whitespace / `x509_crt_bundle` /
    `esp32/spiram.h` build breaks are also worked around
  - current blocker is now a repeatable Arduino-as-component compatibility
    wall against ESP-IDF 5.3.1 in the prov2 env: missing WiFi event/ETH types
    in `WiFiGeneric.h`, `-Werror=overloaded-virtual` failures in the Arduino
    WiFi client headers, and NimBLE-Arduino macro redefinitions while ESP-IDF
    NimBLE is enabled at the same time
  - MQTT / VPS cloud connection is not yet part of *provisioning* (still
  correct — see item 8), but the device now **can** connect to the platform
  broker once Wi-Fi is up: `src/cloud/CloudBridgeService.*` implements the
  canonical `jnx/{tenantId}/{pid}/{deviceId}/{suffix}` bridge end-to-end
  (subscribes `cmd`, dispatches through the same `ControlApi::Unlock()`
  every other input uses, publishes `cmd/ack` + `status` + `lwt`), built and
  hardware-verified 2026-08-20. See `BRIDGE.md` — the full protocol and the
  reuse pattern for future devices lives there now, not here. What's still
  missing is only the *binding* step (item 8 below) — today `homeId` is set
  via a local `/api/cloud` POST, a bench/pilot mechanism, not the real
  provisioning-intent flow. Firmware-side per-device MQTT credential storage
  also now exists separately from `/api/cloud` (`/api/device-mqtt-credential`
  locally or `set_device_mqtt_credential` over `/provision`), but broker-side
  per-device ACLs still have to be built on the platform side before units
  can stop carrying the shared `jenix_platform` login in that slot.

### Required firmware changes for QRunlock

1. Replace the custom provisioning transport with Espressif provisioning:
   - move QRunlock provisioning onto `wifi_provisioning` + `protocomm`
   - use Security Scheme 2
   - keep both BLE and SoftAP transports enabled in the standard build

2. Change the build environment to support ESP-IDF provisioning components:
   - add a dedicated provisioning-capable environment in `platformio.ini`
   - use `framework = arduino, espidf` for the provisioning build
   - do not mix the new provisioning migration into an unverified shipping
     environment without a separate pilot target first

3. Replace the current custom BLE provisioning path:
   - remove the custom write/status GATT provisioning protocol as the primary
     onboarding method
   - use Espressif's provisioning BLE service and endpoints instead
   - keep any local BLE diagnostics separate from the provisioning protocol

4. Replace the current custom SoftAP onboarding path:
   - local HTTP setup pages may remain for diagnostics or service access
   - Wi-Fi onboarding for ONE should use the Espressif provisioning message
     flow, not the current direct `/api/wifi` credential post

5. Fix QRunlock identity formatting:
   - product code should be `QRU`
   - advertised provisioning name should become `JNXQRUXXXXXX`
   - `XXXXXX` must be the last 6 uppercase hex digits of the STA MAC
   - update AP SSID and BLE advertising name generation together

6. Add per-device Proof-of-Possession support:
   - each unit needs its own PoP
   - preferred method is manufacturing-time burn/write
   - if a temporary pilot is needed, generate once on first boot, store in
     NVS, and expose it only for controlled bench testing

7. Keep and integrate the existing local recovery behavior:
   - failed Wi-Fi should still re-enable AP recovery
   - 10-click reset and 30-second hold should clear Wi-Fi credentials and
     relaunch provisioning
   - these recovery actions should restart the standard provisioning manager,
     not the current custom setup path

8. Add the ONE platform post-Wi-Fi bind step:
   - provisioning ends after Wi-Fi success
   - once online, the firmware must call the platform claim/bind flow using
     `deviceId`, `hardwareId`, and the provisioning intent/token expected by
     the ONE backend
   - this is not part of BLE or SoftAP provisioning and must stay separate
   - **partial/interim version exists**: a local `POST /api/cloud` route
     lets a bench operator set `homeId` directly (see `BRIDGE.md` §4), while
     a separate local/per-provisioning device-credential write sets MQTT auth —
     this is not the real bind flow (no auth, no provisioning-intent token,
     purely local-network trust) and should be replaced by the real flow
     above, not extended into one

9. ~~Wire actual cloud-connected state into firmware status~~ — **done,
   2026-08-20**: `cloudConnected_` (`AppController.h`) now reads
   `CloudBridgeService::Connected()` every tick instead of being hardcoded
   `false`. Dashboard status and steady-ON LED behavior are truthful
   whenever the device is actually bound (item 8) and connected.

10. Review the partition and diagnostics layout:
   - add a `coredump` partition for cleaner crash analysis
   - confirm there is enough flash headroom for both BLE and SoftAP
     transports in the final provisioning build

### QRunlock rollout recommendation

- Phase 1: keep the current custom AP recovery path for bench access while a
  separate provisioning build is created
- Phase 2: bring up Espressif Security Scheme 2 over BLE first and validate
  with the ONE app
- Phase 3: add the SoftAP transport and confirm the same app flow works
- Phase 4: switch QRunlock's standard production firmware to the unified ONE
  provisioning stack

### What does not need to change

- Relay pulse logic
- RF learn flow
- local AP recovery concept
- local status reporting and diagnostics pages, as long as they are treated
  as service/debug tools rather than the standard onboarding protocol

---

## 10. QRunlock App-Side Delta (BLE Provisioning)

Firmware side is done and hardware-verified: QRunlock's
`esp32-c3-supermini-prov2` build implements real Espressif `wifi_provisioning`
+ `protocomm` with Security Scheme 2, confirmed end-to-end on real hardware
2026-08-27 — BLE advertise, SRP6a session establishment, encrypted Wi-Fi
credential exchange, self-recovery from a stale-session retry, Wi-Fi connect,
MQTT bind, and a real cloud-triggered unlock all verified working. What's
**not** done is the app side: the ONE app cannot provision a real QRunlock
unit today, at either of two independent layers. Found by direct code
inspection while trying to test the real app flow against real hardware, not
inferred from documentation.

### Gap 1 — discovery mislabels every device as Tank Guard

`bleDiscoveryService.ts`:

- `mapNativeResultToBleScanDevice()` hardcodes
  `pid: foundationPidBlueprint.pid` and `iconText: "TG"` on every scan
  result, regardless of what the device actually reports. A real QRunlock
  unit would be discovered and immediately mislabeled.
- `deriveBusinessDeviceId()` extracts the device ID with a regex expecting
  dash/space-separated segments (`JNX-XXX-YYY-ZZZZZZ`). QRunlock's real BLE
  name is one unbroken string (`JNXQRUC0DCCB`, per Section 2's
  no-separator convention) — the regex never matches, so it silently falls
  back to fabricating `JNX-TG-C3-<transport-id-suffix>` instead of using the
  device's real id.
- Net effect: even if Gap 2 didn't exist, a scanned QRunlock unit would be
  registered to the platform under a fake Tank Guard identity.

### Gap 2 — the wire protocol itself doesn't match QRunlock's firmware

`bleProtocol.ts` / `bleProvisioningService.ts`'s `runBleHandshake()` sends
plain, unencrypted JSON (`{cmd:"hello"}`, then
`{cmd:"set_wifi",ssid,password}`) over a simple custom GATT characteristic —
Tank Guard's original, pre-standard scheme. QRunlock's firmware doesn't
expose that characteristic at all; it speaks Espressif's real
`protocomm`/Security-Scheme-2 protocol (Protobuf message framing, SRP6a key
exchange, AES-256-GCM encrypted session, the specific GATT service UUID
`0000ffff-0000-1000-8000-00805f9b34fb`). These are not compatible at any
level — fixing Gap 1 alone would still fail to connect.

### Recommended implementation path

**Do not hand-roll SRP6a/Protobuf/AES-GCM in TypeScript.** This is
security-critical protocol code; Espressif already publishes audited,
maintained reference clients for exactly this protocol — the same libraries
this document's References section already points to:

- `espressif/esp-idf-provisioning-android` (Kotlin)
- `espressif/esp-idf-provisioning-ios` (Swift)

Since the ONE app is Capacitor (a WebView wrapper that *can* load native
plugins, same mechanism `@capacitor-community/bluetooth-le` already uses),
the lowest-risk path is a **custom Capacitor plugin wrapping Espressif's
native Android library** — Android first, matching the current native build
target; iOS can wrap the Swift equivalent later on the same pattern. This
gets the real, tested SRP6a/Protobuf/crypto implementation for free instead
of reimplementing it, and keeps the web-app layer thin (call `startSession`,
`sendWifiConfig`, etc. through the plugin bridge, same shape as the existing
`BluetoothLe` plugin calls in `bleDiscoveryService.ts`).

### Scope checklist

- [ ] Fix `mapNativeResultToBleScanDevice()` to derive `pid`/`productName`
      from the actual advertised name's product-code segment (Section 2's
      `JNX{code}{6-hex-MAC}` format), not a hardcoded Tank Guard constant —
      needed regardless of the protocol work below, and unblocks correct
      discovery for every product, not just QRunlock.
- [ ] Fix `deriveBusinessDeviceId()`'s regex to match the no-separator naming
      convention actually in use (Section 2), not the dash/space format it
      currently expects.
- [ ] Build (or wrap) a real `protocomm`/Security-Scheme-2 BLE client:
      capability negotiation, SRP6a session establishment, encrypted
      Wi-Fi-config exchange — via a native Capacitor plugin wrapping
      `esp-idf-provisioning-android`, per the recommendation above.
- [ ] Wire the new protocol client into `runBleHandshake()`'s call sites in
      place of the current plain-JSON `hello`/`set_wifi` commands.
- [ ] Update `registerProvisioningIntent`/`registerProvisionedDevice` calls
      to pass the corrected `pid`/`deviceId` from Gap 1's fix.
- [ ] Validate end-to-end against a real QRunlock unit: scan finds it
      correctly labeled, PoP-authenticated session establishes, Wi-Fi
      credentials land, device shows up in the app's QRunlock device page
      afterward. Mirror this document's existing validation pattern
      (Section 8's reuse checklist, `BRIDGE.md` Section 8's equivalent).
- [ ] Once QRunlock is proven, the same client is what every other device in
      Section 7's fleet table needs too (they all target the same
      Security-Scheme-2 standard) — this is a one-time app investment, not
      a per-device cost, same as the firmware side already is.

---

## 11. School Bell Firmware Delta To Reach This Standard

This section is the direct gap list for the current `Smart School Bell`
firmware (`IOT_Device/Smart School Bell/ESP32-S3-RTC-PCM5102/firmware`),
written the same day the App-side gap in Section 12 was found by trying to
provision a real unit (device ID `JNX-SB-S3-95A458`, reachable and live on
the LAN at the time) through the ONE app and hitting a dead end at both
transports.

### Current School Bell status

- `include/services/wifi_service.h` / `src/services/wifi_service.cpp`
  implement a **SoftAP-only** custom scheme: the device opens its own AP,
  runs a local HTTP server, and takes Wi-Fi credentials directly over a
  custom route (the same shape QRunlock's pre-standard firmware used). There
  is **no BLE stack at all** in this firmware — no custom GATT service, not
  even the pre-standard scheme QRunlock had before its migration. Smart
  Mode (BLE) has nothing to discover here regardless of any app-side fix.
- Device/AP naming does not follow Section 2's `JNX{code}{6-hex-MAC}`
  convention:
  - `include/app_config.h`: `kDeviceIdPrefix = "JNX-SB-S3"` (hyphenated,
    includes the chip name) — `device_identity_service.cpp` builds the
    device id as `JNX-SB-S3-{6-hex-MAC}` (e.g. `JNX-SB-S3-95A458`), not the
    no-separator `JNXSBXXXXXX` form every other device (Section 2's table,
    QRunlock's `JNXQRUXXXXXX`) uses.
  - `include/app_config.h`: `kSetupApSsid = "JENIX-SCHOOL-BELL"` is a
    **fixed literal, not MAC-suffixed** — every School Bell unit currently
    advertises the identical AP SSID. Two units in range of each other are
    indistinguishable to a provisioning phone, and this also means the
    AP name carries no per-device identity for the app to key off of.
  - No product code has been reserved for School Bell in Section 2's table
    yet — recommend `SB`.
- No Proof-of-Possession of any kind — the SoftAP has no pairing secret;
  anyone who can join the AP can post Wi-Fi credentials to it.
- Home binding is local/manual only, the same interim state QRunlock was in
  before its own item 8 fix: `src/services/cloud_service.cpp` reads/writes
  `home_id` via a local NVS-backed config (`kNvsHomeId`) set through a local
  bench route, not the platform's provisioning-intent/claim API. MQTT
  status/LWT/OTA ack are otherwise implemented and working once `home_id`
  is set (see the firmware's own `HANDOFF.md`, "Latest Update" section).

### Why this should be easier than the QRunlock pilot, not harder

- `platformio.ini` already builds School Bell with `framework = espidf`
  (native ESP-IDF), not Arduino — QRunlock's pilot had to fight an
  Arduino-as-component compatibility wall against ESP-IDF 5.3.1
  specifically because its shipping build is `framework = arduino`. School
  Bell doesn't have that problem; `wifi_provisioning`/`protocomm` are
  native ESP-IDF components and should integrate directly into the existing
  build, no mixed-framework pilot environment needed.
- `board_upload.flash_size = 16MB`, vs. Token Dispenser's cramped 4MB that
  forced the BLE-only-for-now compromise in Section 7's pilot notes. School
  Bell has ample headroom to ship **both BLE and SoftAP transports
  together** from the start, per Section 1's standard, with no interim
  single-transport compromise needed.

### Required firmware changes for School Bell

**Status, 2026-09-11**: items 1-3 landed in a new `esp32-s3-schoolbell-prov`
PlatformIO env (`ESP32-S3-RTC-PCM5102/firmware/platformio.ini`) that does
not touch the shipping `esp32-s3-schoolbell` env at all — see that firmware
tree's own `HANDOFF.md` for build/bench-test steps. Both envs build and
link clean (verified via a no-space mirror — this repo's own checkout path
hits two unrelated pre-existing space-in-path build bugs, see `HANDOFF.md`);
not yet run against real hardware. Items 4-6 below reflect current status,
not a plan.

1. ~~Reserve product code `SB`...~~ — **done**: reserved in Section 2's
   table above. `device_identity_service.cpp` now builds the standard
   `JNX{code}{6-hex-MAC}` no-separator device id via the shared component's
   `jenix_provisioning_build_name()`, but **only** under the
   `JENIX_PROV_STANDARD` build flag (the new prov env) — the shipping env
   keeps the legacy hyphenated `JNX-SB-S3-{mac}` form and fixed
   `JENIX-SCHOOL-BELL` AP SSID completely unchanged until this is
   hardware-proven and promoted. Confirmed no backend/app code hardcodes
   the old `JNX-SB-S3-` device-id-with-mac form (only the unrelated PID
   string `JNX-SB-S3-001` appears in `PWA_APK`'s `schoolBellPid.ts`, which
   this rename does not touch).
2. ~~Extract the shared component...~~ — **done**:
   `IOT_Device/_shared/jenix_provisioning/` now exists; School Bell is its
   first consumer (BLE scheme only so far). QRunlock has not been
   refactored onto it yet — see Section 8a's status note for why that's
   deferred, not dropped.
3. ~~Assign a per-device Proof-of-Possession~~ — **done, interim pattern**:
   first-boot-generate + persist-to-NVS + print-to-Serial, same as
   QRunlock's pilot. A real manufacturing-time burn step is still needed
   before field shipment, same open item QRunlock has.
4. Keep the existing local SoftAP HTTP control panel (`http://<device-ip>/`
   — device status, manual bell, PTT, etc., confirmed live and working
   2026-09-11 against `JNX-SB-S3-95A458` at 192.168.1.34) as a diagnostics/
   service surface, same as Section 4's scope rule — it is not the
   onboarding protocol and should stay separate from it. **Untouched** —
   the new prov env doesn't change `wifi_service.cpp` or its control panel
   at all.
5. Add the Phase 4 platform bind step: once Wi-Fi connects, call the
   platform's real claim/bind flow with `deviceId`/`hardwareId`/the
   provisioning-intent token, replacing the current local-NVS `home_id`
   bench mechanism in `cloud_service.cpp` — same as QRunlock's own
   still-open item 8. **Still open** — confirmed this REST contract isn't
   implemented anywhere yet (checked `provisioningApi.ts` and QRunlock's
   `CloudBridgeService.cpp`); not something to invent a fake endpoint for.
   `cloud_service.cpp` is untouched, bench mechanism still works.
6. Validate end-to-end against the app per Section 8's reuse checklist,
   using a real unit (`JNX-SB-S3-95A458`). **Partly done, 2026-09-12** —
   flashed to the real unit, BLE Security Scheme 2 session confirmed live
   (advertises `JNXSB95A458`, PoP retrieved via the factory flash tool, see
   `HANDOFF.md`'s "Provisioning Hardware Validation" entry). **Still open**:
   the actual phone/app-side pairing through the Jenix One app itself
   (no phone in the validating session). SoftAP scheme for this env is also
   still open (BLE first, matching Section 9's own rollout phasing), per
   Section 8a/9's "no simultaneous BLE+SoftAP in one `wifi_prov_mgr`
   session" note.

### School Bell rollout recommendation

Same four-phase shape as QRunlock's Section 9 recommendation: (1) keep the
current SoftAP control panel for bench access while the provisioning work
lands in a separate env/branch, (2) bring up BLE + Security Scheme 2 first
and validate against the app, (3) add SoftAP and confirm the same app flow,
(4) switch School Bell's standard firmware to the unified stack. Given
School Bell's native-ESP-IDF build and 16MB flash, phases 2 and 3 can
plausibly land together rather than needing QRunlock's staged
BLE-then-SoftAP split.

---

## 12. School Bell App-Side Delta (Both Transports)

Found 2026-09-11 while trying to provision a real, live School Bell unit
(`JNX-SB-S3-95A458`, online at `192.168.1.34`, onboard control panel
confirmed reachable and functional) through the ONE app.

### AP Mode — explicitly blocked for this product today

`PWA_APK/apps/web-pwa/src/features/provisioning/ap/ApProvisioningPage.tsx`
(around lines 136-138) shows, verbatim: *"AP Mode isn't available yet for
{product}... This flow currently only supports {descriptor.productName}'s
own hotspot."* The AP-mode HTTP contract is only wired for one product
(Tank Guard's own SoftAP routes); School Bell's real SoftAP contract
(`wifi_service.cpp`'s routes) was never plugged into this generic screen,
so the app refuses School Bell outright rather than attempting a mismatched
request.

### Smart Mode — would hit the same Gap 1 / Gap 2 as QRunlock, plus firmware has nothing to answer

Even after Section 11's firmware work lands, School Bell's BLE
provisioning would need the same app-side fix already required for
QRunlock in Section 10: `bleDiscoveryService.ts`'s
`mapNativeResultToBleScanDevice()` hardcodes every scan result to Tank
Guard's PID/icon, and `deriveBusinessDeviceId()`'s regex expects the
dash/space-separated legacy naming, not the no-separator
`JNX{code}{6-hex-MAC}` convention. Today, School Bell additionally has no
BLE stack to discover at all (Section 11), so Smart Mode simply times out
with nothing found.

### Recommended fix

No new app-side work is School-Bell-specific — Section 10's checklist
(fix product/pid derivation from the advertised name, build or wrap a real
`protocomm`/Security-Scheme-2 BLE client, e.g. via a Capacitor plugin
wrapping `esp-idf-provisioning-android`) fixes discovery and the wire
protocol for **every** product at once, School Bell included, once its
firmware speaks the standard protocol from Section 11. The one School-Bell-
specific app change needed is unblocking `ApProvisioningPage.tsx`'s
product gate once School Bell's own SoftAP contract is migrated to the
standard `wifi_provisioning` SoftAP transport (Section 11 item 2) — at that
point its SoftAP requests look like every other standard device's and the
generic AP-mode screen should work without a product-specific carve-out.

---

## References

- Espressif, "Unified Provisioning": https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/provisioning.html
- Espressif Developer Blog, "Simple Provisioning" (2026) — source for the
  Security Scheme 2 / SRP6a production recommendation quoted in Section 1.
- RFC 5054 — SRP6a for TLS, the key-exchange method Security Scheme 2 is
  based on.
- `espressif/esp-idf-provisioning-android` and
  `espressif/esp-idf-provisioning-ios` — Espressif's own open-source
  reference client implementations of this exact protocol.
