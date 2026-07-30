# Jenix One — Device Provisioning Standard

**Applies to:** every current and future Jenix One device (Tank Guard, Nurse Call
Receiver, Smart RF Bridge, Token Dispenser, P10 Display, SOS Siren, and anything
that ships after this document).
**Adapted from:** the FloodGuard provisioning standard
(`D:\IOT Device\RUB\FloodGuard\HARDWARE\PROVISIONING.md`), which was already
written to extend beyond FloodGuard. This document is the Jenix One-specific
version of that same standard.
**Status:** target standard. See "Section 7 — Current State" below — none of
the six devices shipped so far actually implement this yet; each one currently
uses a different, incompatible BLE scheme. This document is what new firmware
work (and a follow-up alignment pass on existing firmware) should converge on.

---

## 0. Scope — read this first

**BLE and AP provisioning have exactly one job: hand the device its Wi-Fi
credentials and confirm it joined the network.** That's it. Once the device
replies `wifi_connected:true`, provisioning is done — the phone disconnects
and walks away. Connecting to MQTT/the Jenix VPS is the device's own concern
after that, over its new Wi-Fi link, entirely independent of BLE or the app.
The app does not wait for it, poll for it, or confirm it during provisioning.

This applies identically to both transports:
- **BLE** — writes/reads the same JSON commands over the FF01 characteristic.
- **AP (SoftAP fallback)** — the same JSON payload, sent as an HTTP POST
  instead of a BLE write, once the phone is on the device's hotspot.

One JSON contract, two transports. See Section 3 (Phase 2 / Phase 2-AP) and
Section 4 for the exact payloads.

---

## 1. Why this document exists

Every Jenix device onboarded so far implemented BLE provisioning independently,
and no two of them agree:

| Device | Service UUID | Characteristics | Response channel |
|---|---|---|---|
| P10 Display | `1234...` (custom) | 2 write-only (`CHAR_WIFI`, `CHAR_BIND`) | none — fire-and-forget, app can't know if WiFi connected |
| SOS Siren | not yet defined | stub only | none |
| (others) | ad hoc, unverified | ad hoc | ad hoc |

That means the app can't share one BLE code path across products, installers
can't rely on one mental model, and there is no way for the phone to confirm a
device actually joined Wi-Fi. This document fixes that by defining one scheme
every device uses, so the platform's BLE app code (already implemented in
`PWA_APK/apps/web-pwa/src/features/provisioning/ble/`) works identically
regardless of which product is being paired.

---

## 2. Device Naming Convention

### BLE Advertisement Name
```
JNX + {2-4 letter product code} + {last 6 hex digits of Wi-Fi STA MAC, uppercase}
```
Product codes (matching the PID codes already in use):

| Product | Code | Example name (MAC ...BA:F9:68) |
|---|---|---|
| Tank Guard | `TG` | `JNXTGBAF968` |
| Nurse Call Receiver | `NC` | `JNXNCBAF968` |
| Smart RF Bridge | `RF` | `JNXRFBAF968` |
| Token Dispenser | `TD` | `JNXTDBAF968` |
| P10 Display | `P10` | `JNXP10BAF968` |
| SOS Siren | `SOS` | `JNXSOSBAF968` |

The app's scan filter matches the wide `JNX` prefix (so it discovers any Jenix
device regardless of product), then reads the exact product via the `hello`
response. Firmware should not need the app to know every product code ahead of
time — only the `JNX` root prefix is load-bearing for discovery.

---

## 3. Full Provisioning Flow

### Phase 0 — First Boot Detection
```
Device starts
  └─ NVS has WiFi credentials?
       ├─ YES → skip BLE, go directly to WiFi connect (Phase 3)
       └─ NO  → enter BLE advertisement mode (Phase 1)
```

### Phase 1 — BLE Advertisement
- Start BLE, advertise as `JNX{ProductCode}{6-hex-MAC}`
- Service UUID: `0000ff00-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000ff01-0000-1000-8000-00805f9b34fb`
  (READ + WRITE + WRITE_NR — one bidirectional channel, not one characteristic
  per field)
- Initial characteristic value: `{"ok":true,"cmd":"ready"}`
- Timeout: BLE runs indefinitely until credentials received OR factory reset

### Phase 2 — BLE Credential Exchange
App writes a JSON command to the characteristic, then polls-reads the same
characteristic for the JSON response (no separate notify channel required for
v1 — see Section 6.1 for the recommended upgrade):

| Command | Payload | Response |
|---|---|---|
| `hello` | `{"cmd":"hello"}` | `{"ok":true,"cmd":"hello","pid":"JNX-TG-C3-001","ble_name":"JNXTGBAF968","wifi_connected":false,"ssid":"","ip":""}` |
| `scan_wifi` | `{"cmd":"scan_wifi"}` | `{"ok":true,"cmd":"scan_wifi","networks":[{"ssid":"HomeNet","rssi":-45}]}` (up to 8) |
| `set_wifi` | `{"cmd":"set_wifi","ssid":"MyNet","password":"pass"}` | `{"ok":true,"cmd":"set_wifi","wifi_connected":true,"ip":"192.168.1.42"}` |

Short aliases for compact BLE packets: `"cmd":"h"`/`"w"` with `"s"`/`"p"` for
ssid/password. The `hello` response's `pid` field is what lets one app-side
code path identify which product it's talking to — include it from day one on
every new device, unlike the current firmware which mostly omits it.

On `set_wifi` success:
- Credentials saved to NVS (persistent across reboot)
- Device replies with IP address
- App receives response → shows success → device stops BLE

### Phase 2-AP — AP (SoftAP) Credential Exchange, when BLE isn't available
Same JSON contract as Phase 2, different transport: the phone connects to the
device's own Wi-Fi hotspot (SSID = the device's BLE name, e.g. `JNXTGBAF968`)
and sends one HTTP POST instead of a BLE write:

```
POST http://192.168.4.1/provision
Content-Type: application/json

{"cmd":"set_wifi","ssid":"MyNet","password":"pass"}
```
Response (identical shape to the BLE `set_wifi` response):
```json
{"ok":true,"wifi_connected":true,"ip":"192.168.1.42"}
```
This is a plain request/response — no polling needed, since HTTP already
gives you a synchronous reply. Implement this as a small local web server
(the device's existing captive-portal/AP web server, if it has one) with one
route. `hello`/`scan_wifi` are optional here; `set_wifi` is the only command
the app actually calls over AP today.

### Phase 3 — WiFi Connection
```
WiFi.begin(ssid, pass)
  ├─ Connected (within 20s timeout)
  │    ├─ Stop BLE advertising / SoftAP
  │    └─ Provisioning is done from here on — proceed to Phase 4 on its own,
  │       not driven by the phone
  └─ Failed
       └─ Reply {"ok":true,"cmd":"set_wifi","wifi_connected":false,"ip":""}
          App shows error, user retries or tries a different password
```

### Phase 4 — Cloud Connection (device's own responsibility, not part of provisioning)
```
WiFi connected
  └─ Device connects to Jenix VPS MQTT on its own, over its new Wi-Fi link.
     Neither the phone nor BLE/AP has any role here -- the app has already
     disconnected by this point. The device will simply show up "online" on
     the dashboard once MQTT connects, on whatever timeline that takes.
```

### Phase 5 — Steady State
- MQTT to VPS: telemetry, alerts, remote config
- Factory reset (button hold, device-specific duration) → clears NVS Wi-Fi →
  reboots to Phase 1

---

## 4. Credential Encoding

Plain JSON, UTF-8, hex-encoded before writing to the characteristic (the app
converts the JSON string to a hex string and back — the bytes on the wire are
the same either way, hex-encoding is just how the Capacitor BLE plugin's
`DataView` API is used on the app side). No encryption, no BLE pairing/bonding
in v1 — see Section 6.5 for the recommended re-provisioning lock, since without
it any nearby phone can re-provision a device that's still advertising.

```json
{"cmd":"set_wifi","ssid":"MyHomeWiFi","password":"mysecretpass"}
```

No cloud endpoint, tenant ID, or MQTT broker is sent over BLE — the MQTT host
is fixed in firmware, and home/tenant binding happens after the device is
online, through the normal provisioning-intent API
(`registerProvisioningIntent` / `registerProvisionedDevice` /
`completeProvisioningIntent` in `PWA_APK/apps/web-pwa/src/features/provisioning/services/provisioningApi.ts`),
not over the BLE channel itself.

---

## 5. App UI Flow

Already implemented in `PWA_APK/apps/web-pwa/src/features/provisioning/ble/`:
tap "+" on the Devices page → animated radar scan (auto-starts, no button tap
needed) → device list → Wi-Fi credential form → animated progress steps → done.
See `BleRadarScanner.tsx`, `BleDeviceScanList.tsx`, `BleProvisioningPage.tsx`.
New devices that follow this standard need no app-side UI changes — only
firmware needs to speak the protocol above.

---

## 6. Recommended Enhancements (apply as firmware work happens)

### 6.1 BLE Notify Characteristic (High priority)
Add a second NOTIFY characteristic so the device pushes status instead of the
app polling, for the Wi-Fi handoff itself (not cloud/MQTT -- out of scope per
Section 0):
```json
{"event":"wifi_connecting","ssid":"MyHomeWiFi"}
{"event":"wifi_connected","ip":"192.168.1.42"}
{"event":"wifi_failed","reason":"wrong_password"}
```

### 6.2 QR Code on Device Label (High priority)
```json
{"id":"JNXTGBAF968","pid":"JNX-TG-C3-001"}
```
Scanning it auto-selects the device in the BLE scan list, skipping manual
selection when several devices are nearby.

### 6.3 AP Fallback Mode — app side already implemented
If BLE provisioning fails (BLE disabled on phone, older Android): device opens
a SoftAP named the same as its BLE name, phone connects, app POSTs to
`http://192.168.4.1/provision` per Phase 2-AP above. The web-pwa app already
does this (`apProvisioningService.ts`) — firmware implementing the
`/provision` route is the remaining piece.

### 6.4 Re-Provisioning Lock (Medium priority)
After first successful provisioning, BLE advertising stops permanently.
Re-provisioning requires a physical button hold (device-specific duration)
until the status LED flashes. Prevents a neighbour or anyone nearby from
re-provisioning a device left advertising.

### 6.5 Auth Token for Silent Re-Provisioning (Low priority)
For installers managing many devices: accept `set_wifi` after the lock in 6.4
only if a valid token is included:
```json
{"cmd":"set_wifi","ssid":"NewNet","password":"pass","token":"device-specific-token"}
```

---

## 7. Current State (as of this document)

None of the six devices shipped so far implement this standard yet:

| Device | Firmware BLE code | Matches this standard? |
|---|---|---|
| Tank Guard | not located in this pass | unverified |
| Nurse Call Receiver | not located in this pass | unverified |
| Smart RF Bridge | `BleProvisioningService.cpp/.h` (multiple copies across `_tmp_*` work folders) | unverified — needs review |
| Token Dispenser | `ble_provisioning.cpp/.h` | unverified — needs review |
| P10 Display | `ble_provisioning.cpp/.h` | **No.** Custom `1234...` service UUID, two write-only characteristics (`CHAR_WIFI`, `CHAR_BIND`), no response/status channel at all — the app has no way to confirm Wi-Fi actually connected. Also only uses 2 hex MAC digits for the BLE name, not 6. |
| SOS Siren | `BleProvisioningService.cpp/.h` | **No.** Header is a bare stub (`begin()`, `advertisedName()`) — no UUIDs, no characteristics defined yet. |

**This means:** the app-side code (`bleDiscoveryService.ts` /
`bleProvisioningService.ts`) can implement this standard correctly today, but
it will not be able to actually provision any of the six existing physical
devices until their firmware is updated to match — that's a separate,
hardware-facing effort (reflashing real units) and should happen deliberately,
not as a side effect of an app redesign. Treat this table as the punch list
for that follow-up.

---

## 8. Reuse Checklist for New Devices

- [ ] Product code chosen and added to the table in Section 2 (2-4 letters, no
      clash with an existing product)
- [ ] BLE name = `JNX{code}{6-hex-MAC}`, service UUID `0000ff00...`,
      characteristic UUID `0000ff01...` (reuse — do not invent a new UUID per
      product; the whole point is one app code path for every device)
- [ ] `hello` response includes the real `pid` string for that device
- [ ] `set_wifi` returns `wifi_connected` + `ip` — never fire-and-forget
- [ ] `/provision` HTTP route implemented on the SoftAP web server for the AP
      fallback path, same JSON payload/response shape as BLE `set_wifi`
- [ ] Neither BLE nor the AP web server tries to report MQTT/cloud status —
      that happens on the device's own after Wi-Fi connects (Section 0)
- [ ] NVS namespace is unique to the product (avoid clashing with another
      Jenix product sharing the same chip family)
- [ ] Factory reset button hold time + LED feedback pattern documented in the
      device's own firmware README

---

## 9. Quick Reference — BLE Packet Examples

```json
// App -> Device: check status
{"cmd":"hello"}

// Device -> App: response
{"ok":true,"cmd":"hello","pid":"JNX-TG-C3-001","ble_name":"JNXTGBAF968","wifi_connected":false,"ssid":"","ip":""}

// App -> Device: scan networks
{"cmd":"scan_wifi"}

// Device -> App: network list
{"ok":true,"cmd":"scan_wifi","networks":[{"ssid":"HomeNet","rssi":-45},{"ssid":"GuestNet","rssi":-72}]}

// App -> Device: provision
{"cmd":"set_wifi","ssid":"HomeNet","password":"mysecretpass"}

// Device -> App: success
{"ok":true,"cmd":"set_wifi","wifi_connected":true,"ip":"192.168.1.42"}

// Device -> App: failure
{"ok":true,"cmd":"set_wifi","wifi_connected":false,"ip":""}
```

AP fallback uses the exact same payload/response shapes, just over HTTP
instead of a BLE characteristic:

```
POST http://192.168.4.1/provision
{"cmd":"set_wifi","ssid":"HomeNet","password":"mysecretpass"}

200 OK
{"ok":true,"wifi_connected":true,"ip":"192.168.1.42"}
```
