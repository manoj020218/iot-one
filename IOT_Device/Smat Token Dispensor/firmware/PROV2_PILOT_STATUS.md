# Token Dispenser — Provisioning V2 Pilot: Status / Resume Notes

Saved 2026-08-07. Read this first if picking the work back up after an interruption.

## 2026-08-31 update

- `pio run -e jenix-td-c3-prov2` now completes on this machine and emits
  `C:\pio-builds\jenix-td-c3-firmware\jenix-td-c3-prov2\firmware.bin`
  (1,553,936 bytes, built 2026-08-31).
- The old `__idf_src` / `_project_elf_src` PlatformIO blocker documented below
  is no longer the active stop point in the current workspace. The mixed build
  now uses `src_dir = main`, an isolated Arduino framework copy, and the
  `prov2_espidf5_bootstrap.py` compatibility path pinned to ESP-IDF 5.3.1.
- `pio run -e jenix-td-c3` also builds on 2026-08-31, but the produced
  `firmware.bin` is now 1,428,000 bytes, so the old 2026-08-07
  "byte-identical 1,350,296 bytes" baseline is no longer current. Treat the
  default-env no-regression claim below as historical until a fresh known-good
  baseline is re-established from the current toolchain state.
- Build the two envs sequentially when re-checking this file. Running them in
  parallel against the shared `C:/pio-builds/jenix-td-c3-firmware` root causes
  noisy Windows cleanup warnings even though the env subdirectories differ.

## Goal

Migrate this firmware to Espressif's official `wifi_provisioning`/`protocomm` stack
(SRP6a + AES-256-GCM, "Security Scheme 2") per `../../PROVISIONING.md`, replacing
the old plaintext-JSON-over-BLE scheme in `src/ble_provisioning.cpp`. Token Dispenser
is the de facto pilot device (ahead of Tank Guard, named in the standard doc), on the
condition that the currently-shipping, tested `jenix-td-c3` build must not regress.

## Status: code complete, build verification blocked on a toolchain bug

### Done (all implemented, do not redo)

1. `platformio.ini` — new `[env:jenix-td-c3-prov2]`: `framework = arduino, espidf`,
   own partition table, `-DJENIX_PROV_V2=1`, NimBLE-Arduino dropped from `lib_deps`
   for this env only. Also added `[platformio] build_dir = C:/pio-builds/jenix-td-c3-firmware`
   (see "Blocker" below for why — this is required for ANY env using espidf, applies
   globally but is inert: confirmed the default env still produces a byte-identical
   `firmware.bin`, 1,350,296 bytes, after this change).
2. `partitions_prov2.csv` — new file, single merged ~3MB app partition (no A/B OTA
   rollback in this pilot env only — trade made deliberately for flash headroom).
3. `sdkconfig.defaults` — new file. Enables `CONFIG_BT_NIMBLE_ENABLED`,
   `CONFIG_ESP_PROTOCOMM_SUPPORT_SECURITY_VERSION_2`, `CONFIG_WIFI_PROV_BLE_SEC_CONN`,
   and `CONFIG_FREERTOS_HZ=1000` (arduino-esp32-as-IDF-component requires this,
   IDF defaults to 100). Only consumed by envs using framework=espidf.
4. `src/provisioning2.h` / `src/provisioning2.cpp` — new files, the actual
   `wifi_provisioning`/`protocomm` wrapper, mirroring `BleProvisioning`'s
   begin/stop/isActive/isProvisioned surface. Verified against the REAL ESP-IDF
   headers cached on this machine (not written from memory):
   - `esp_srp_gen_salt_verifier()` — on-device SRP6a salt/verifier generation from
     an auto-generated PoP; confirmed via `protocomm/include/crypto/srp6a/esp_srp.h`
     that this exact use case ("generate salt and verifier on the fly for
     development... or for devices which intentionally want to generate different
     password each time") is what the API is documented for.
   - `wifi_prov_scheme_ble_set_service_uuid()` — set to the byte-reversed form of
     PROVISIONING.md's fixed UUID `021a9004-0382-4aea-bff4-6b3f1c5adfb4`
     (`{0xb4,0xdf,0x5a,0x1c,0x3f,0x6b,0xf4,0xbf,0xea,0x4a,0x82,0x03,0x04,0x90,0x1a,0x02}`),
     computed programmatically and cross-checked against Espressif's own example.
   - SRP6a username `"wifiprov"` — Espressif's own reference-app/SDK default
     (confirmed in `examples/provisioning/wifi_prov_mgr` and its pytest), matching
     the reference client SDKs PROVISIONING.md cites as the app's basis.
   - PoP: auto-generated random 12-byte value on first boot if none in NVS
     (namespace `jnx_pop`), persisted, printed to Serial + EventLog for bench
     testing (no manufacturing PoP-burning tool exists yet — approved interim).
   - Entire file guarded in `#ifdef JENIX_PROV_V2 ... #endif` — PlatformIO compiles
     every `src/*.cpp` for every environment regardless of what `main.cpp`
     `#include`s, so this must no-op cleanly for the default env rather than pull
     in ESP-IDF-only headers it doesn't have. (Caught by actually rebuilding the
     default env and watching it fail — not assumed.)
5. `src/ble_provisioning.cpp` — now guarded the opposite way,
   `#ifndef JENIX_PROV_V2 ... #endif`, because the prov2 env drops NimBLE-Arduino
   from `lib_deps` (can't link two BLE stacks against one controller) so this file
   would otherwise fail to find `NimBLEDevice.h` when building that env.
6. `src/main.cpp` — compile-time swap via `#ifdef JENIX_PROV_V2` /
   `#define ProvisioningImpl (Provisioning2|BleProvisioning)` at the include and at
   the two call sites (`setup()`'s `ProvisioningImpl::begin()`, `loop()`'s
   `ProvisioningImpl::isActive()`). Also added a `JENIX_PROV_V2`-guarded fix in
   `loop()`: reading `wifi_provisioning`'s actual source (`manager.c`) showed it
   force-calls `esp_wifi_set_mode(WIFI_MODE_STA)` both on provisioning start and on
   credential-receive, which would silently kill the firmware's always-on
   local-config SoftAP (`connectWifi()`/`startAP()`). The guard restores AP+STA
   mode (`WiFi.mode(WIFI_AP_STA)` + re-`WiFi.softAP(...)`) if the manager reset it
   away — found by reading the real IDF source, not guessed.
7. `src/config_store.cpp` — `factoryReset()` now also clears the `jnx_pop`
   namespace and calls `wifi_prov_mgr_reset_provisioning()`, gated to
   `JENIX_PROV_V2` builds only.
8. `../../PROVISIONING.md` — fleet status table updated: Token Dispenser marked as
   active pilot, Tank Guard moved to "pending, after Token Dispenser validates".
   Added an explicit notes section calling out the two interim deviations (BLE-only
   for now, auto-generated PoP) as deliberate and scoped to be revisited, not
   silent scope creep.

### Verified so far

- `pio run -e jenix-td-c3` (the default, currently-shipping env) — rebuilt **twice**
  since all the above changes, both times producing a **byte-identical**
  `firmware.bin`: 1,350,296 bytes / 85.8% flash. Confirmed unaffected.

### Current blocker — NOT a code problem, a PlatformIO toolchain bug

Building `jenix-td-c3-prov2` (`pio run -e jenix-td-c3-prov2`) hit a chain of
environment issues, each diagnosed from source, in order:

1. **Whitespace in the project path** (`D:\IOT Device\...\Token Dispensor\firmware`)
   — ESP-IDF's CMake build hard-fails on this
   (`builder/frameworks/espidf.py:1720`). Fixed via the `build_dir` override
   above — confirmed via PlatformIO's own source this is a real, supported,
   per-project setting that only relocates the transient/gitignored build cache,
   not source.
2. **Missing/mismatched Python packages** in PlatformIO's dedicated ESP-IDF
   virtualenv (`~/.platformio/penv/.espidf-4.4.7`) — `idf_component_manager`,
   `kconfiglib`, `future`, etc. Its automatic setup had partially failed earlier
   due to SSL cert errors reaching PyPI on this machine. Fixed by installing the
   exact versions pinned in ESP-IDF 4.4.7's own `requirements.txt`
   (`~/.platformio/packages/framework-espidf@3.40407.240606/requirements.txt`),
   plus one explicit pin (`idf-component-manager~=1.2`, since a bare
   `pip install idf_component_manager` grabs a too-new major version that dropped
   the old CLI interface ESP-IDF 4.4.7 calls).
3. **`CONFIG_FREERTOS_HZ` stuck at 100** — fixed in `sdkconfig.defaults`, but had
   to delete a stale auto-generated `sdkconfig.jenix-td-c3-prov2` file that had
   already locked in the old value (Kconfig defaults only fill *unset* options).
4. **Current, unresolved blocker**: after a clean configure, CMake produces a
   real, working executable target (named `_project_elf_src` — confirmed present
   in `<build_dir>/jenix-td-c3-prov2/.cmake/api/v1/reply/`), but the installed
   `platform-espressif32@6.13.0` package's own builder script
   (`~/.platformio/platforms/espressif32/builder/frameworks/espidf.py`, around
   line 1862-1864) looks for a target literally named `__idf_src`
   (`"__idf_%s" % os.path.basename(PROJECT_SRC_DIR)`) to confirm the build
   succeeded, doesn't find it, and errors: `"Couldn't find the main target of the
   project!"`. This is a mismatch inside PlatformIO's own tooling for this
   specific pairing (`platform-espressif32@6.13.0`'s builder script expectations
   vs. the ESP-IDF 4.4.7 / `framework-espidf@3.40407.240606` it auto-selected for
   `framework=arduino,espidf` mode) — not fixable from project files alone.

## Plan to resolve the blocker (agreed with user, not yet executed)

Try in this order, stop and report back after each attempt rather than cascading
silently, since option 2 touches shared machine tooling outside this repo:

1. **Check for a newer `platform-espressif32` release** that may have already
   fixed this pairing bug. If found: install and verify the **default env
   first** (`pio run -e jenix-td-c3` must still produce byte-identical
   `firmware.bin`, 1,350,296 bytes) before trusting it for the pilot env, since
   `platform = espressif32` is one value shared by every env in this
   `platformio.ini`. Revert immediately if the default env's output changes at
   all.
2. **If no newer version fixes it**: locally patch
   `~/.platformio/platforms/espressif32/builder/frameworks/espidf.py` (the
   `project_target_name` check around line 1862-1864) to also accept the actual
   generated target name (`_project_elf_src`). This modifies machine-wide
   PlatformIO tooling outside this repo — every ESP-IDF project on this machine —
   and would be silently reverted by a future `pio pkg update`, so document
   exactly what changed for easy reapply/revert.
3. **If neither works in reasonable effort**: stop; the code stays as-is
   (complete, cross-referenced against real headers, just not build-verified).
   Revisit on a cleaner PlatformIO install or in CI rather than sinking more time
   into this specific machine's toolchain state.

## Verification checklist (once the blocker clears)

1. Default env unaffected — re-confirm after any platform version change.
2. `pio run -e jenix-td-c3-prov2` succeeds, `firmware.bin` fits the ~3MB `app0`
   partition in `partitions_prov2.csv`.
3. **Needs real hardware** — flash via `pio run -e jenix-td-c3-prov2 -t upload`,
   confirm BLE advertising as `JNXTD{6hex}`, run the phone app's add-device flow,
   confirm the SRP6a/Security2 handshake completes, credentials land in
   `ConfigStore` correctly (compare against the old plaintext flow's behavior),
   confirm WiFi/MQTT come up exactly as before.
4. Promotion of the pilot's approach to the default `jenix-td-c3` env is a later,
   separate decision — not part of this task.

## Files changed this session

- `platformio.ini` (new env + `build_dir`)
- `partitions_prov2.csv` (new)
- `sdkconfig.defaults` (new)
- `src/provisioning2.h` (new)
- `src/provisioning2.cpp` (new)
- `src/ble_provisioning.cpp` (guarded with `#ifndef JENIX_PROV_V2`)
- `src/main.cpp` (compile-time provisioning swap + AP-mode restore guard)
- `src/config_store.cpp` (`factoryReset()` extended, guarded)
- `../../PROVISIONING.md` (fleet status + pilot notes)
- This file (`PROV2_PILOT_STATUS.md`) — new, for resuming after interruption

Machine-level changes made outside this repo (not tracked by git, will need
redoing on a different machine): the pip installs into
`~/.platformio/penv/.espidf-4.4.7` listed under "Current blocker" step 2 above.
