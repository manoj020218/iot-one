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

Already built and unaffected by this document: the "+" button on the Devices
page, the animated radar scan, the Wi-Fi credential form, the progress
screens (`PWA_APK/apps/web-pwa/src/features/provisioning/`). What changed is
only what runs underneath once a device is selected — the app now speaks the
real `protocomm`/`wifi_provisioning` protocol described above (Protobuf
messages, SRP6a handshake, AES-256-GCM session) instead of a custom scheme,
using audited cryptographic primitives rather than anything hand-written for
the SRP6a/AES math.

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
| Tank Guard | ESP32-C3 | PlatformIO + Arduino | pilot device — implement first |
| Nurse Call Receiver | ESP32-C3 | PlatformIO + Arduino | pending, after pilot validates |
| Smart RF Bridge | ESP32-C3 | PlatformIO + Arduino | pending |
| Token Dispenser | ESP32-C3 | PlatformIO + Arduino | pending |
| P10 Display | ESP32-C3 | PlatformIO + Arduino | pending |
| SOS Siren | ESP32-C3 | PlatformIO + Arduino | pending — no BLE stack exists yet, clean implementation |
| Smart Streamer | ESP32-P4 | native ESP-IDF | pending — simplest integration, already native ESP-IDF |

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

## References

- Espressif, "Unified Provisioning": https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/provisioning/provisioning.html
- Espressif Developer Blog, "Simple Provisioning" (2026) — source for the
  Security Scheme 2 / SRP6a production recommendation quoted in Section 1.
- RFC 5054 — SRP6a for TLS, the key-exchange method Security Scheme 2 is
  based on.
- `espressif/esp-idf-provisioning-android` and
  `espressif/esp-idf-provisioning-ios` — Espressif's own open-source
  reference client implementations of this exact protocol.
