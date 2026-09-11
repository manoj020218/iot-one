# Smart School Bell — Bring Provisioning to QRunlock Parity

## Why this document exists

School Bell firmware (`ESP32-S3-RTC-PCM5102/firmware/`) has real, working
bell/audio/PTT functionality — confirmed live on 2026-09-11 against a real
unit (`JNX-SB-S3-95A458`, control panel reachable and functional at
`http://192.168.1.34/`) — but it was never brought onto the platform's
provisioning standard. Right now it can only join Wi-Fi through its own
custom SoftAP scheme, has no BLE stack at all, and cannot be added to a
Home through the Jenix One app by either provisioning path (AP mode is
explicitly blocked for this product in the app; Smart Mode/BLE has nothing
to discover). This is not a small gap — it means no real School Bell unit
can currently be onboarded through the app end-to-end.

**Read `../../PROVISIONING.md` first, in full** — specifically Section 8a,
Section 11, and Section 12, which already document this device's exact
gap list, file-by-file, from a direct code audit done the same day this
document was written. This document does not repeat that content; it is
the instruction to act on it.

## The one requirement that matters most: build this as reusable infrastructure, not a School-Bell-only fix

Section 8a of `../../PROVISIONING.md` was added specifically because of
this task. QRunlock already has a working, hardware-verified
`wifi_provisioning`/`protocomm` (Security Scheme 2, BLE) implementation in
`IOT_Device/QRunlock/src/connectivity/BleProvisioningService.*`. The
naive move is to copy that file into School Bell, rename the product
code, and call it done — **do not do that.** That pattern (bespoke
per-device copies of what should be shared platform infrastructure) is
what already cost this project a second MQTT bridge adapter for Token
Dispenser (see `IOT_Device/Smat Token Dispensor/QRUNLOCK_PARITY_MASTER_PROMPT.md`'s
opening paragraph). Provisioning must not repeat it, especially since
School Bell is only the *second* device to implement this — the cheapest
possible point to extract shared code is now, before a third copy exists.

Concretely:

1. Extract the BLE + SoftAP + Security-Scheme-2 + PoP + platform-bind
   implementation into one shared, product-agnostic component —
   `IOT_Device/_shared/jenix_provisioning/` is the suggested location, but
   pick whatever your build tooling can actually reference cleanly.
   Parameterize it by exactly four things: product code, PID, a PoP
   source, and the platform bind endpoint/credentials. Nothing else should
   need to vary per device.
2. Refactor QRunlock's existing `BleProvisioningService.*` to consume that
   shared component instead of keeping its own copy. QRunlock becomes the
   first *consumer*, not a permanently-separate original.
3. School Bell becomes the second consumer, supplying: product code `SB`
   (needs reserving in Section 2's table), its PID, a PoP source (first-
   boot-generate-and-persist-to-NVS is an acceptable interim, same as
   QRunlock's pilot — see Section 11 item 3), and the bind endpoint.
4. School Bell's build is native ESP-IDF already (`platformio.ini`,
   `framework = espidf`) — no Arduino-compatibility wall to design around,
   unlike QRunlock's pilot env. If anything, build the shared component's
   native-ESP-IDF path against School Bell first and treat QRunlock's
   Arduino+ESP-IDF mixed build as the harder consumer to retrofit after.
5. Whatever device ships after School Bell should be able to adopt this by
   supplying the same four parameters — no new BLE/SoftAP/crypto code, no
   copy-paste. If you hit a real, concrete reason a given device's build
   can't reference the shared component, write that reason down in that
   device's own section of `../../PROVISIONING.md` rather than defaulting
   to a copy for convenience.

## Scope note

Everything above is firmware-side and self-contained to School Bell's own
tree plus the new shared component location — yours to build outright.
Section 12 of `../../PROVISIONING.md` (the App-side delta: AP-mode's
product gate in `ApProvisioningPage.tsx`, and BLE discovery's Tank-Guard
hardcoding in `bleDiscoveryService.ts`) touches the shared ONE app and
needs the platform maintainer — it is not blocked on you, and you are not
blocked on it either: firmware can implement and hardware-bench-validate
the standard protocol (Section 11's checklist) independent of when the app
side lands, the same way QRunlock's firmware was hardware-verified before
its own app-side gap (Section 10) was found and fixed.

## On the internet-connectivity question

Worth being explicit about this since it shapes both the bind-step design
(item 3 above) and how you bench-test it:

- **During BLE/SoftAP Wi-Fi credential exchange (Phase 1-3 of Section
  3):** neither the phone nor the device needs internet access. This is a
  direct local link (Bluetooth, or the device's own SoftAP hotspot) —
  no cloud round-trip happens or should happen here.
- **After Wi-Fi connects (Phase 4):** the *device* needs real internet
  access over the Wi-Fi network it just joined, to reach the Jenix
  platform's MQTT broker and complete the bind/claim call. A phone-only
  hotspot with no upstream internet, or a home network with a captive
  portal / no WAN, will get the device onto "Wi-Fi connected" but it will
  never appear bound/online on the dashboard.
- **The Home/tenant bind REST call itself** is made by the *phone app*, as
  an ordinary authenticated API call (Section 4) — the phone needs
  internet access for that call to reach the platform API, same as any
  other screen in the app.

Bench-test accordingly: BLE/SoftAP pairing can be validated with the
device and phone completely offline from each other's perspective, but
end-to-end "shows up bound in the app" validation needs the device's
Wi-Fi network actually routed to the internet.

## Reference implementation to study, not copy

- `IOT_Device/QRunlock/src/connectivity/BleProvisioningService.*` — real,
  hardware-verified Security Scheme 2 over BLE.
- `IOT_Device/QRunlock/PROVISIONING.md` — this used to be a stale forked
  duplicate of the root doc; it's now a pointer. If you're reading this
  from a stale local clone and see full content there instead of a
  pointer, that's drift — the root file is the source of truth.
- QRunlock's `esp32-c3-supermini-prov2` PlatformIO env — the mixed
  `framework = arduino, espidf` pattern, `sdkconfig.defaults` for Security
  Scheme 2 / NimBLE, and `partitions_prov2.csv` shape. School Bell won't
  need the Arduino-mixing part, but the `sdkconfig.defaults` Security
  Scheme 2 / NimBLE settings are directly relevant.

## Definition of done

Mirrors `../../PROVISIONING.md` Section 8's reuse checklist, plus:

- [ ] Shared `jenix_provisioning` component exists and QRunlock has been
      refactored to consume it (not just School Bell added alongside it)
- [ ] School Bell advertises as `JNXSB{6-hex-MAC}` over both BLE and
      SoftAP, Security Scheme 2, validated against a real unit
- [ ] Per-device PoP in place (manufacturing burn, or documented first-
      boot-generate interim)
- [ ] Platform bind call replaces the local-NVS `home_id` bench mechanism
      in `cloud_service.cpp`
- [ ] Existing SoftAP control panel (`http://<device-ip>/`) still works,
      now positioned as a diagnostics surface rather than the onboarding
      path
- [ ] End-to-end validated on real hardware: BLE or SoftAP pairing
      completes, device shows up bound and online in the app, matching
      QRunlock's own 2026-08-27 hardware verification
