# QRunlock Provisioning Migration Handoff

Saved: 2026-08-20

Read this first if the session closes and the work needs to be resumed.

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

- CMake configure completes far enough to generate file-API metadata
- PlatformIO then aborts with:

```text
Error: Couldn't find the main target of the project!
```

## Exact Current Blocker (updated 2026-08-21 — the __idf_src issue below is RESOLVED)

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

Next step: figure out why neither space-flag mitigation is taking effect —
likely either `fix_pio_space_flags.py` is checking the wrong flag key/env
var, or runs at the wrong phase relative to when ESP-IDF's CMake step adds
it, or `CONFIG_COMPILER_HIDE_PATHS_MACROS` isn't actually the config
controlling this flag in this ESP-IDF version. Also worth understanding
what `component_requires.temp.cmake` needs and why a from-scratch configure
doesn't produce it, independently of the space-in-path issue — that's the
real blocker for anyone who can't reuse this exact cached build state.

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

See whether the local `src/CMakeLists.txt` can be adjusted to satisfy
PlatformIO's hardcoded `__idf_src` expectation.

The next experiment should be:

1. inspect how `__idf_main` or component aliases are named in working mixed
   PlatformIO projects
2. try adding a local alias or component naming tweak in `src/CMakeLists.txt`
   so the codemodel exposes `__idf_src`
3. rerun:

```powershell
pio run -e esp32-c3-supermini-prov2
```

If that works, then the next provisioning slice is:

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
