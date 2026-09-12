# jenix_provisioning

Shared ESP-IDF component implementing the Jenix One provisioning standard
(`../../../PROVISIONING.md`, Sections 1-3): `wifi_provisioning` + `protocomm`,
Security Scheme 2 (SRP6a / AES-256-GCM), BLE or SoftAP transport, advertised
as `JNX{product_code}{6-hex-STA-MAC}` (Section 2).

Built per Section 8a's requirement: one implementation every device consumes,
not a per-device copy. First integrated into School Bell
(`IOT_Device/Smart School Bell/`); QRunlock's own
`src/connectivity/BleProvisioningService.*` is the proven reference this
component's logic was generalized from, and is planned to be refactored onto
this component as a follow-up (see `PROVISIONING.md` Section 8a/11).

## Using it

1. Make this component discoverable. If your project's own path has no
   spaces, add this directory straight to `EXTRA_COMPONENT_DIRS` in your
   project's root `CMakeLists.txt` and skip to step 2. If it does (like
   every consumer in *this* repo -- confirmed 2026-09-11 that
   `EXTRA_COMPONENT_DIRS` with more than one space-containing entry breaks
   ESP-IDF's own space-disambiguation heuristic), add a thin
   forwarding-stub `CMakeLists.txt` under your own project's
   `components/jenix_provisioning/` instead, pointing `SRCS`/`INCLUDE_DIRS`
   back at this directory's `src/`/`include/` (see School Bell's
   `ESP32-S3-RTC-PCM5102/firmware/components/jenix_provisioning/CMakeLists.txt`
   for a working example) -- ESP-IDF auto-discovers a project's own
   `components/` with no extra config.
2. Merge `sdkconfig.fragment`'s lines into your own `sdkconfig.defaults`.
3. Add `jenix_provisioning` to your own "main"/`src` component's
   `idf_component_register(... REQUIRES ...)` -- gate it behind a build
   flag if you want it optional per env, the way School Bell's
   `JENIX_PROV_STANDARD` flag does.
4. Call `jenix_provisioning_start()` (see `include/jenix_provisioning.h`) only
   when you've confirmed no Wi-Fi station credentials are already stored
   (Section 3 Phase 0) -- this component does not make that check for you.
   Calling it again with a *different* scheme than whatever's active
   switches to it (see the header) -- useful for e.g. a button that forces
   SoftAP for whoever can't use BLE, since only one scheme runs at a time
   (see below).

## What this does not do (yet)

- No platform claim/bind REST call. That contract does not exist anywhere in
  this repo yet (checked against both QRunlock's `CloudBridgeService` and the
  app's `provisioningApi.ts` as of 2026-09-11) -- `on_wifi_connected` hands
  the caller `device_id`/`ip` and the caller decides what to do, the same
  shape QRunlock's own bridge already uses. Add a real `bind_endpoint`
  parameter here once the platform side exists, rather than inventing one.
- No simultaneous BLE + SoftAP in one session -- `wifi_prov_mgr` is a true
  Espressif singleton (one static context, one scheme; confirmed against
  `manager.c` and Espressif's own reference `wifi_prov_mgr` example, which
  picks a scheme at build time). `jenix_provisioning_start()` can *switch*
  schemes on request (stops/deinits the old one, starts the new one), but
  never runs two at once. School Bell wires this to `ButtonEvent::LongPress`
  (see its own `HANDOFF.md`) as the "can't use BLE, force AP Mode instead"
  path; SoftAP-scheme starts share the caller's own httpd via
  `softap_httpd_handle` (Espressif's `wifi_prov_scheme_softap_set_httpd_handle()`)
  so a device's own diagnostic HTTP routes keep working on the same server.
- No manufacturing-time PoP burn tooling -- `proof_of_possession = NULL`
  falls back to generate-once/persist-to-NVS/print-to-Serial, same interim
  QRunlock's pilot uses (`PROVISIONING.md` Section 7).
