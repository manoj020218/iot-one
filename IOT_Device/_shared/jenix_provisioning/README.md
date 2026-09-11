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

1. Add this directory to your build's `EXTRA_COMPONENT_DIRS` (PlatformIO:
   set `board_build.cmake_extra_args` or, simpler, add
   `EXTRA_COMPONENT_DIRS` in your project's own `CMakeLists.txt`).
2. Merge `sdkconfig.fragment`'s lines into your own `sdkconfig.defaults`.
3. Add `jenix_provisioning` to your `idf_component_register(... REQUIRES ...)`.
4. Call `jenix_provisioning_start()` (see `include/jenix_provisioning.h`) only
   when you've confirmed no Wi-Fi station credentials are already stored
   (Section 3 Phase 0) -- this component does not make that check for you.

## What this does not do (yet)

- No platform claim/bind REST call. That contract does not exist anywhere in
  this repo yet (checked against both QRunlock's `CloudBridgeService` and the
  app's `provisioningApi.ts` as of 2026-09-11) -- `on_wifi_connected` hands
  the caller `device_id`/`ip` and the caller decides what to do, the same
  shape QRunlock's own bridge already uses. Add a real `bind_endpoint`
  parameter here once the platform side exists, rather than inventing one.
- No simultaneous BLE + SoftAP in one session -- `wifi_prov_mgr` takes one
  scheme per `wifi_prov_mgr_init()` call by design (Espressif's own API
  shape). Callers pick a scheme per `jenix_provisioning_start()` call; both
  QRunlock's and School Bell's own rollout recipes in `PROVISIONING.md`
  bring up BLE first and add SoftAP as a second, separately-validated phase
  for exactly this reason.
- No manufacturing-time PoP burn tooling -- `proof_of_possession = NULL`
  falls back to generate-once/persist-to-NVS/print-to-Serial, same interim
  QRunlock's pilot uses (`PROVISIONING.md` Section 7).
