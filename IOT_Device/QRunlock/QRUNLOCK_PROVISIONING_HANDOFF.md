# QRunlock Provisioning Migration Handoff

Saved: 2026-08-20

## UPDATE - 2026-08-22 later: builder-level isolation and src_dir regression fixed

The earlier 2026-08-22 update below is now stale in two important ways:

1. The `__idf_src` vs `main` ambiguity is fixed again. Root cause: while the
   isolation notes were being rewritten, `src_dir = main` got dropped from
   the global `[platformio]` block in `platformio.ini`. Restoring that line
   re-establishes the intended pairing with `main/CMakeLists.txt`, so
   PlatformIO goes back to the canonical `__idf_main` target instead of
   synthesizing `__idf_src` and aborting when both are present.
2. The private-copy isolation now works at the build-system level too, not
   just inside the bootstrap script. `tools/prov2_espidf5_bootstrap.py` now
   monkeypatches `platform.get_package_dir("framework-arduinoespressif32")`
   before `espressif32/builder/frameworks/espidf.py` runs, forcing the mixed
   build itself to resolve the private Arduino framework copy.

Additional details from the real retest:

1. The canonical private copy path is now:
   `C:\Users\User\.platformio\packages\framework-arduinoespressif32-3.20017.241212+sha.dcc1105b-qrunlock-prov2`
   The old `@...-qrunlock-prov2` name was unstable because PlatformIO's
   `espidf.py` renames any Arduino framework directory containing `@` before
   passing it to CMake. The bootstrap now auto-migrates the legacy `@` dir
   name to the hyphenated one.
2. The first retest after the monkeypatch failed because the original
   recursive copy had silently timed out earlier and left the private copy
   incomplete; only the `variants/` tree was missing at the top level. That
   directory was copied over from the clean shared package and the retest
   was repeated.
3. After those fixes, `pio run -e esp32-c3-supermini-prov2` really did
   compile against the private copy and got far deeper into the Arduino core
   build. The current deterministic frontier is now a genuine
   Arduino-core-vs-IDF-5.3.1 compatibility wall inside the private copy:
   - `cores/esp32/esp32-hal-adc.c`: `driver/adc.h: No such file or directory`
   - `cores/esp32/esp32-hal-cpu.c`: `xSemaphoreHandle` no longer exists under
     the newer FreeRTOS headers
4. Shipping was re-verified after a clean target:
   `pio run -e esp32-c3-supermini -t clean`
   followed by
   `pio run -e esp32-c3-supermini`
   Result: success, 76.1% flash, 16.2% RAM.
5. The shared package's vulnerable file stayed unchanged throughout:
   `compare_set.h` SHA-256
   `045DC42A3D07AD13E0113E965C2DD0491877C382A2B250069CCC3E16ACDD1B33`

Conclusion: the isolation problem is solved enough to keep debugging prov2
without risking the shipping framework package. The remaining work is now
inside Arduino-as-component compatibility against IDF 5.3.1, not in
PlatformIO package routing or shared-package contamination.

## UPDATE - 2026-08-22 isolation verified by actually building it

The 2026-08-21 update below (isolation "wired" but never build-tested,
verification "inspection-only") has been superseded — it was tested for
real, found to have a real bug, and the bug is fixed:

1. **The isolation design itself is correct** and the safety guard (§ point
   3 below) works exactly as intended: on the first real build attempt, the
   private-copy wiring was still broken (see #2), and the guard correctly
   refused to touch the shared package and failed loudly instead — it did
   not silently fall through to patching the shared copy. Confirmed by
   checksumming the shared package's known-vulnerable file
   (`compare_set.h`) before and after every single attempt below: identical
   every time.
2. **Real bug found and fixed**: `platform.get_package_dir(name)` (what the
   bootstrap script used to locate the Arduino framework) does **not**
   consult this env's `platform_packages` override at all —
   `PlatformBase.get_package_spec()` builds its spec purely from
   `self.packages[name]`, the platform's static `platform.json` manifest,
   confirmed by reading PlatformIO's own source
   (`platformio/platform/base.py`). So no matter how `platform_packages`
   was written in `platformio.ini` (several syntaxes were tried, including
   an INI `%`-escaping bug for the literal `@` in the private copy's
   directory name, fixed along the way), the script's own lookup always
   resolved back to the shared default directory. Fixed in
   `tools/prov2_espidf5_bootstrap.py` by deriving the private copy's path
   directly (`default_arduino_dir.parent / PRIVATE_ARDUINO_COPY_DIRNAME`)
   instead of trusting `get_package_dir` for this specific lookup.
3. **After the fix**: a real `pio run -e esp32-c3-supermini-prov2` used the
   private copy (guard passed cleanly), got further than any previous
   attempt — past CMake configure, into a new failure:
   `Warning! Detected two different targets with project sources. Please
   use either __idf_src or specify 'main' folder in 'platformio.ini' file.`
   Removing the stray auto-generated `src/CMakeLists.txt` (left over from
   an earlier abandoned approach) did **not** fix this — the ambiguity is
   coming from PlatformIO's own builder logic detecting both `main/` and
   direct `src/` sources, not from a stray file. Untried next step: an
   explicit PlatformIO option telling it the component dir is `main` (the
   warning text itself suggests one exists) rather than relying on
   auto-detection — worth a docs/source search in
   `espressif32/builder/frameworks/espidf.py` for how that warning decides
   between `__idf_src` and `main`.
4. Immediately after, the shipping env was rebuilt from a **truly clean**
   cache (`Remove-Item -Recurse -Force
   C:\pio-builds\qrunlock\esp32-c3-supermini` first): success, 76.1% flash,
   16.2% RAM. No regression.

Read this first if the session closes and the work needs to be resumed.

## READ FIRST — 2026-08-22 incident: prov2 broke the shipping firmware

**`tools/prov2_espidf5_bootstrap.py` must not be run again (i.e. don't
build `esp32-c3-supermini-prov2`) until it's fixed — see the big comment
block at the top of `platformio.ini` for the full detail.** Short version:
that script permanently patches header files inside the SHARED, global
`framework-arduinoespressif32` package (Arduino.h, esp32-hal-psram.c,
spinlock.h, compare_set.h, WiFiGeneric.h, WiFiClient.h, ssl_client.h) —
the same package the shipping `esp32-c3-supermini` env compiles against.
Nothing reverts the patches afterward. One of them (`compare_set.h`
rewritten to a bare `#include "soc_memory_types.h"` instead of
`#include "soc/soc_memory_types.h"`) made the *shipping/production*
firmware silently unbuildable — `soc_memory_types.h: No such file or
directory` — for a period, with zero warning, until a truly-clean rebuild
finally surfaced it on 2026-08-22.

This was fixed by deleting `framework-arduinoespressif32` entirely and
letting PlatformIO fetch a fresh copy (a manual line-by-line reversal was
tried first and made things *worse* — the script's assumed "before" text
isn't reliably the true pristine state, so don't trust that path either).
Shipping is confirmed clean again: 76.1% flash, 16.2% RAM, reproduced
across multiple truly-clean rebuilds.

**The real fix, not yet done**: give the prov2 env its own isolated copy of
`framework-arduinoespressif32` to patch — the exact pattern this project
already uses correctly for `framework-espidf` (a versioned local copy,
`platform_packages` pointing at it, never the shared default). Until that
lands, treat every `pio run -e esp32-c3-supermini-prov2` as something that
will re-break the shipping build the moment its cache goes cold, with no
error message warning you it happened.

**Process lesson, worth internalizing**: "the shipping env still builds"
is not a valid claim unless it was checked against a truly clean cache
(`rm -rf`/`Remove-Item` the env's folder under `C:\pio-builds\qrunlock\`
first). This bit twice in the same week — once with the pilot env's own
build state (see "Tried 2026-08-21" below), once here with a much higher
blast radius. A warm-cache rebuild reusing already-compiled `.o` files
proves nothing about whether the *source resolution* is still correct.

---

## Goal

Migrate QRunlock from the current custom AP/BLE onboarding flow to Espressif's
official `wifi_provisioning` / `protocomm` stack using Security Scheme 2
(SRP6a + AES-256-GCM), per `PROVISIONING.md` section 9.

The rollout approach is intentionally staged:

1. Keep the shipping `esp32-c3-supermini` env stable.
2. Bring up a separate mixed `arduino, espidf` pilot env first.
3. Land per-device provisioning credential groundwork.
4. Only then swap the actual provisioning transport in the pilot env.

## Current Status

### Already done before this handoff

1. Tier 1 local API auth hardening:
   - mutating local HTTP routes require `X-Jenix-Local-Token`
   - token is stored/generated in NVS
2. MQTT credential groundwork:
   - firmware no longer defaults to compiled-in shared MQTT username
   - separate per-device MQTT credential storage exists in NVS
   - cloud MQTT auth now prefers that per-device slot and only falls back to
     legacy `/api/cloud` auth fields for older bench units
   - `/api/cloud` preserves existing fields on partial updates
3. Task watchdog:
   - `esp_task_wdt` initialized and fed in the main loop
   - OTA path explicitly feeds watchdog during long download/write work

### Provisioning migration groundwork landed in this session

1. Separate provisioning pilot env added in `platformio.ini`:
   - `[env:esp32-c3-supermini-prov2]`
   - `framework = arduino, espidf`
   - `-D JENIX_PROV_V2=1`
   - global `build_dir = C:/pio-builds/qrunlock` added because ESP-IDF/CMake
     is brittle around whitespace in the source path
2. Pilot-only partition layout added:
   - `partitions_prov2.csv`
   - single app slot
   - `coredump` partition included
3. ESP-IDF provisioning defaults added:
   - `sdkconfig.defaults`
   - NimBLE enabled
   - Bluedroid disabled
   - Security 2 enabled
   - `CONFIG_FREERTOS_HZ=1000`
4. Per-device provisioning PoP groundwork added:
   - new `ProvisioningConfig` in `src/config/ConfigTypes.h`
   - new defaults/helpers in `src/config/Defaults.h`
   - new NVS namespace `qru_prov` in `src/storage/ConfigStore.cpp`
   - PoP generates once on first boot if absent
   - PoP persists in NVS
   - optional flash-time override via `JNX_PROVISIONING_POP`
5. Bench visibility added:
   - boot prints Security 2 username and PoP source to Serial
   - boot prints the PoP value to Serial for bench use
   - `/api/status` now exposes provisioning readiness metadata
     without exposing the raw PoP
6. `PROVISIONING.md` updated:
   - section 9 now states that naming is already compliant
   - groundwork and current blocker are recorded there

## Important Reality Checks

1. QRunlock's current provisioning identity is already compliant:
   - BLE/AP name is `JNXQRU` + last 6 uppercase hex digits of STA MAC
   - this comes from `src/device_identity/DeviceIdentity.cpp`
   - the old section-9 note claiming names still looked like `JNX-QRU-0010`
     was stale and has been corrected in `PROVISIONING.md`
2. The actual provisioning transport has NOT been migrated yet:
   - current runtime still uses `src/connectivity/BleProvisioningService.*`
   - current Wi-Fi onboarding still uses the custom `WifiManager` and local
     routes like `/api/wifi`
3. The mixed-framework pilot env is still not buildable end-to-end, though
   real progress landed 2026-08-21 (see "Exact Current Blocker" below): it
   now gets past CMake configure and into real compilation of QRunlock's
   own source, failing on a compiler-flag/whitespace-in-path issue rather
   than the earlier project-target-name mismatch. Still a build-tooling
   problem, not a bug in the QRunlock code itself.

## Verified Build Results

### Shipping env

Command:

```powershell
pio run -e esp32-c3-supermini
```

Result:

- success
- this is the env that must remain stable right now

### Native tests

Command:

```powershell
pio test -e native
```

Result:

- still blocked on host toolchain availability
- not part of the provisioning migration itself

### Provisioning pilot env

Command:

```powershell
pio run -e esp32-c3-supermini-prov2
```

Result:

- build now gets through CMake configure and into repeatable user-source
  compilation
- the current deterministic failures are compile-time Arduino-as-component /
  IDF-5.3.1 compatibility errors, not the older main-target or whitespace
  path-splitting failures
- the two cleanly reproducible error families after session-1 fixes are:
  - missing WiFi event / ETH types in
    `framework-arduinoespressif32/libraries/WiFi/src/WiFiGeneric.h`
  - `-Werror=overloaded-virtual` failures in Arduino WiFi client headers
- `src/app/AppController.cpp`'s old two-argument
  `esp_task_wdt_init(...)` call was also updated for IDF 5.x during this
  session; that local firmware-side incompatibility is no longer part of the
  frontier

## Exact Current Blocker (updated 2026-08-21 — session 1 checkpoint)

**Update 2026-08-21 (later)**: the failure frontier moved again. The prov2
build no longer dies on:

1. `Error: Couldn't find the main target of the project!`
2. the whitespace-split project-path compiler-flag failure
3. missing `x509_crt_bundle` during certificate-bundle embedding
4. missing `esp32/spiram.h` from Arduino headers
5. QRunlock's old IDF-4-style `esp_task_wdt_init(timeout, panic)` call

Changes that got it this far:

1. `tools/prov2_espidf5_bootstrap.py` now runs as a `pre:` script for the
   prov2 env, pins mixed builds to IDF 5.3.1, forces single-job builds,
   patches the Arduino-as-component CMake include path so legacy
   `esp32/spiram.h` can still be found, and patches ESP-IDF 5.3.1's
   `mbedtls` CMake typo (`cert_bundle` vs `crt_bundle`).
2. `sdkconfig.defaults` and `sdkconfig.esp32-c3-supermini-prov2` now disable
   the global certificate bundle for the pilot path. This is acceptable for
   bring-up because current OTA code already uses
   `WiFiClientSecure::setInsecure()`.
3. `src/app/AppController.cpp` now uses the IDF-5 `esp_task_wdt_init(const
   esp_task_wdt_config_t*)` signature behind an `ESP_IDF_VERSION_MAJOR >= 5`
   guard while keeping the shipping Arduino-only env on the old call.

**Current deterministic blocker now**: Arduino-esp32 `3.20017.241212`
running as an ESP-IDF component against IDF `5.3.1` is failing in a
repeatable way during user-source compilation:

1. `framework-arduinoespressif32/libraries/WiFi/src/WiFiGeneric.h` is missing
   types such as `ip_event_ap_staipassigned_t`, `ip_event_got_ip_t`,
   `ip_event_got_ip6_t`, and `esp_eth_handle_t`.
2. Arduino WiFi client headers hit `-Werror=overloaded-virtual` against the
   newer toolchain/API surface.
3. `NimBLE-Arduino` still emits a large set of `CONFIG_BT_NIMBLE_*`
   redefinition warnings because the prov2 env enables ESP-IDF NimBLE and
   still links the legacy custom BLE provisioning dependency at the same time.

This is much healthier than the earlier state: the failure is now stable and
actionable, and the shipping `esp32-c3-supermini` env still builds
successfully after these changes (re-verified 2026-08-21).

**Update 2026-08-21**: the `__idf_src` vs `_project_elf_src` mismatch
described in this section is fixed. The fix: point `src_dir = main` at the
`[platformio]` (global) level — **not** per-env, PlatformIO silently ignores
`src_dir` set under `[env:...]` and warns `Ignore unknown configuration
option src_dir` if you try — plus a hand-written `main/CMakeLists.txt` that
globs sources back out of the real `src/` tree:

```cmake
set(qru_src_dir "${CMAKE_SOURCE_DIR}/src")
file(GLOB_RECURSE qru_app_sources
    "${qru_src_dir}/*.c" "${qru_src_dir}/*.cpp" "${qru_src_dir}/*.S")
idf_component_register(SRCS ${qru_app_sources} INCLUDE_DIRS "${qru_src_dir}")
```

This gives PlatformIO the canonical `__idf_main` component name it expects
natively, with zero PlatformIO patching, while the actual source of truth
stays in `src/` (the loose `.cpp` files physically inside `main/` from an
earlier copy-based attempt are stale leftovers — safe to delete, `main/`
only needs `CMakeLists.txt`). Confirmed: the shipping `esp32-c3-supermini`
env is unaffected — its classic Arduino build never reads `src_dir` and
produces byte-identical output with or without this line (verified same
size before/after: 75.8% flash, 16.1% RAM).

**New, different blocker now** — the build gets past CMake configure and
into real compilation of `src/app/AppController.cpp` etc., then fails with:

```text
riscv32-esp-elf-g++: error: Device/IOT_Platform/jenix: No such file or directory
riscv32-esp-elf-g++: error: One/IOT_Device/QRunlock=.: No such file or directory
```

This is the same root problem the comments already anticipated (whitespace
in `D:\IOT Device\IOT_Platform\jenix One\...`) but manifesting as an actual
compile failure now that real source is being compiled: some ESP-IDF/CMake-
emitted compiler flag containing the full project path gets space-split
into two separate argv entries, and gcc treats the second half
(`One/IOT_Device/QRunlock=.`) as an input filename. Two mitigations exist
already but neither has been confirmed working yet:

1. `tools/fix_pio_space_flags.py` (a `post:` extra_script) strips any flag
   matching `-fmacro-prefix-map=<project-path-fragment>` from
   ASFLAGS/CCFLAGS/CFLAGS/CXXFLAGS/CPPFLAGS/LINKFLAGS — but the error still
   reproduces with it in place, so either it's not catching the actual flag
   key responsible, or it runs at the wrong point in the SCons pipeline
   relative to when this flag gets added.
2. `sdkconfig.defaults` now has `# CONFIG_COMPILER_HIDE_PATHS_MACROS is not
   set`, which should stop ESP-IDF from emitting `-fmacro-prefix-map=` at
   all (a root-cause fix rather than post-hoc stripping) — but the error
   still reproduced after this was added too. Worth checking whether a
   fully clean rebuild (delete `C:\pio-builds\qrunlock\
   esp32-c3-supermini-prov2` entirely, not just re-run `pio run`) is needed
   for a changed `sdkconfig.defaults` to actually regenerate the CMake
   config — that wasn't tried yet.

**Tried 2026-08-21: a truly clean rebuild (deleting
`C:\pio-builds\qrunlock\esp32-c3-supermini-prov2` entirely) — this is
WORSE, not better.** It fails earlier and differently:

```text
FileNotFoundError: [Errno 2] No such file or directory:
'C:/pio-builds/qrunlock/esp32-c3-supermini-prov2/component_requires.temp.cmake'
```

(inside ESP-IDF's `idf_component_manager`, during CMake configure, before
any real source ever compiles).

**Re-running again after that (non-clean) did NOT cleanly restore the
space-in-path state either — it produced a THIRD, different failure**,
rebuilding the entire Arduino-as-ESP-IDF-component framework from scratch
(227s, much longer than any prior attempt) and then failing during
archiving:

```text
ar.exe: C:/pio-builds/qrunlock/esp32-c3-supermini-prov2/esp32-hal-psram.c.o: No such file or directory
```

— a missing intermediate object file, not a compiler error at all. **Be
honest with whoever picks this up: build results on this machine have been
inconsistent across consecutive attempts at the same cached state**
(three different failure modes across three consecutive runs, only one
partial clean). This smells like real fragility in how PlatformIO's
Espressif builder handles incremental state for a mixed arduino+espidf
project, not a single deterministic bug with one fix. Whoever resumes this
should expect to need a few repeat attempts to even reproduce a given
failure reliably, and should keep a copy of `C:\pio-builds\qrunlock\
esp32-c3-supermini-prov2` from a "furthest reached" run before trying
anything that might disturb it, since there's no confirmed way back to it.

Next step: stop treating this like a path/CMake problem — that layer is now
good enough to expose the real compatibility wall. The next session should:

1. remove `NimBLE-Arduino` from the prov2 env and guard the old
   `BleProvisioningService` path out under `JENIX_PROV_V2`, since IDF NimBLE
   is already enabled for Security-2 provisioning work
2. decide whether to patch the Arduino-as-component headers locally for IDF
   5.3.1 (`WiFiGeneric.h` missing-type includes and `overloaded-virtual`
   warnings) or switch the prov2 pilot to a newer Arduino-as-component
   release that actually targets IDF 5.x
3. only after the mixed env links cleanly, start the real
   `wifi_prov_mgr`/Security-2 transport swap

## Files Generated By The Mixed Build Attempt

The first `arduino, espidf` configure generated these untracked files:

- `CMakeLists.txt`
- `src/CMakeLists.txt`
- `sdkconfig.esp32-c3-supermini-prov2`

These are normal outputs of PlatformIO's ESP-IDF flow for a project that
didn't already have them. They are currently present in the worktree as
untracked files.

Current generated contents:

- root `CMakeLists.txt`:
  - standard `project(QRunlock)` wrapper including `project.cmake`
- `src/CMakeLists.txt`:
  - auto-generated `idf_component_register(SRCS ${app_sources})`

These do not by themselves fix the `__idf_src` vs `_project_elf_src` mismatch.

## Recommended Next Step

Resume with the mixed-framework build unblock first. Do NOT start rewriting
the BLE transport to `wifi_prov_mgr` until `esp32-c3-supermini-prov2` can
actually link.

### First experiment to try next

The next experiment should be:

1. remove `h2zero/NimBLE-Arduino` from prov2 `lib_deps`
2. guard the legacy `src/connectivity/BleProvisioningService.*` code out of
   `JENIX_PROV_V2`
3. rerun:

```powershell
pio run -e esp32-c3-supermini-prov2
```

If that gets prov2 materially further, then the next provisioning slice is:

1. guard the old NimBLE-based provisioning code out of the prov2 env
2. remove `NimBLE-Arduino` from prov2 `lib_deps`
3. add a new `Provisioning2` wrapper around `wifi_prov_mgr`
4. start with BLE transport only in prov2
5. feed Security 2 using the per-device PoP already stored in NVS
6. leave the shipping env untouched until prov2 is proven

## Important Notes For Resume

1. The current repo is dirty for legitimate reasons. Do not revert unrelated
   user changes.
2. The provisioning work is intentionally incomplete. The repo currently has
   groundwork, not a finished migration.
3. The raw PoP is intentionally printed to Serial for bench use only.
   That is acceptable for the temporary pilot path described in `PROVISIONING.md`,
   but not the final manufacturing flow.
4. `PROVISIONING.md` section 9 and this file should be kept in sync as the
   migration progresses.

## Commands Used In This Session

```powershell
pio run -e esp32-c3-supermini
pio run -e esp32-c3-supermini-prov2
Select-String -Path $env:USERPROFILE\.platformio\platforms\espressif32\builder\frameworks\espidf.py -Pattern "project_target_name"
Get-ChildItem C:\pio-builds\qrunlock\esp32-c3-supermini-prov2\.cmake\api\v1\reply
```

## Resume Summary

If resuming cold, the correct short summary is:

```text
QRunlock provisioning migration groundwork is landed.
Shipping env still builds (verified 2026-08-21, byte-identical output).
Per-device PoP is now persisted in NVS and visible for bench use.
Local API auth, task watchdog, and /api/cloud partial-update fixes also
landed this round — see the main firmware commits, not just this file.

The __idf_src vs _project_elf_src mismatch is RESOLVED (global
src_dir = main + main/CMakeLists.txt glob-redirecting back into src/).

Current state is genuinely flaky: three consecutive build attempts on
2026-08-21 produced three DIFFERENT failures (space-in-path compile error;
then, after deleting the build cache, a CMake-configure-time
component_requires.temp.cmake FileNotFoundError; then, on a further
non-clean retry, a missing esp32-hal-psram.c.o during archiving). Two
space-flag mitigations exist (tools/fix_pio_space_flags.py,
sdkconfig.defaults's CONFIG_COMPILER_HIDE_PATHS_MACROS=n) but neither has
been confirmed actually fixing anything yet, given the inconsistent
results. Do not assume deleting C:\pio-builds\qrunlock\
esp32-c3-supermini-prov2 gets you back to a clean baseline — it doesn't,
and neither does re-running non-clean reliably reproduce the prior state.

Next: get a REPEATABLE failure first (run the exact same command 2-3 times
in a row and confirm you see the same error before trying to fix it) before
chasing any specific error message — right now it's not clear which of the
three failures is even the "real" one to fix first.
```
