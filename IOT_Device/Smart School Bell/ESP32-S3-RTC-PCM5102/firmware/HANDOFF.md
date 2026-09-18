# Provisioning Phone + S3 Front-Panel Validation - 2026-09-13

This section supersedes the 2026-09-12 phone-pairing-not-yet-done note and
Provisioning Pilot next-step item 1 below.

Real bench unit: JNX-SB-S3-95A458, Wi-Fi STA MAC 44:1B:F6:95:A4:58, CH340
COM30. Firmware-only work; no APK was built or changed.

**Provisioning result: the BLE/SRP6a hardware gate is passed.**

- Built esp32-s3-schoolbell-prov from the exact repository source through the
  documented no-space mirror, then uploaded it to the real ESP32-S3. Every
  written region passed esptool hash verification.
- The shared QRunlock factory tool's reset/capture implementation read a
  complete record from Serial:
  [FACTORY] pid=JNX-SB-S3-001 ble_name=JNXSB95A458
  pop_username=wifiprov pop=2NGBV7NDDAHH
- A real Android phone discovered JNXSB95A458 over BLE at bench range.
  Jenix One physically saw the advertisement, but currently labels it
  "Unrecognized Jenix device (SB)" and disables selection because School Bell
  is absent from the app/shared PID blueprint catalog. This is a platform
  catalog gate, not a BLE-radio failure.
- Firmware pairing was therefore validated with Espressif's BLE provisioning
  client on that same phone. Entered PoP 2NGBV7NDDAHH. The first attempt
  generated the phone's SRP session key but the ESP rejected the proof.
- Root cause was verified against actual QRunlock source, not copied board
  settings: QRunlock Security 2 and Jenix One both use SRP username wifiprov,
  while the shared School Bell component used jenix. QRunlock is ESP32-C3 and
  School Bell is ESP32-S3; only the chip-independent Security 2 username
  contract was reused.
- Changed the shared provisioning username to wifiprov, rebuilt and reflashed.
  The phone then completed SRP6a, submitted Wi-Fi credentials, and reported
  Wi-Fi connected. This closes the requested phone-pairing bench gate.

**New provisioning persistence integration gap observed:** after the later
firmware-only pin/LED reflash (NVS was not erased), School Bell booted without
a station config and started BLE provisioning again. WifiService loads only
its private jenix_wifi namespace, while wifi_prov_mgr writes the standard
ESP-IDF station configuration; the successful provisioning callback currently
logs device/IP but does not mirror the received credentials into jenix_wifi.
Treat phone SRP6a and the live first Wi-Fi join as passed, but persistent
post-reboot onboarding is still open.

**VPS/MQTT:** not changed here. The user assigned that connection/bind work to
the platform/cloud developer. A failed MQTT connection is not used to qualify
the BLE/SRP result.

**ESP32-S3 front-panel pins (do not reuse on QRunlock C3):**

- GPIO5: service/reset button, active-low to GND with the internal pull-up.
  Existing behavior is retained: short press rings, 3-second press requests SoftAP,
  and 10-second factory reset is still only a logged placeholder. A true reset
  policy was not invented as part of this pin assignment.
- GPIO6: data output for one WS2812 status LED. GPIO5 and GPIO6 are adjacent
  on the School Bell board's left header and do not overlap its RTC, SDMMC,
  PCM5102, PTT/microphone, USB, strapping, or N16R8 PSRAM assignments.
- Replaced ordinary GPIO LED toggling with ESP-IDF RMT WS2812 signaling (GRB).
  Status colors are blue boot, green ready, cyan sync, amber RTC-invalid, and
  red fatal. This source was built and flashed successfully; firmware reached
  "Firmware ready". Physical WS2812 illumination still needs an LED wired to
  GPIO6/5V-or-3V3-as-rated/GND for visual confirmation.

Latest build: SUCCESS, esp32-s3-schoolbell-prov, RAM 54,924 / 327,680 bytes
(16.8%), flash 2,031,576 / 3,145,728 bytes (64.6%). Latest upload to COM30:
SUCCESS with all hashes verified.
Normal esp32-s3-schoolbell environment also builds successfully with the same
WS2812 driver: RAM 45,168 / 327,680 bytes (13.8%), flash 1,776,568 /
3,145,728 bytes (56.5%).

---

# Provisioning Hardware Validation — 2026-09-12

Real bench unit (`JNX-SB-S3-95A458` / MAC `44:1B:F6:95:A4:58`), connected via
USB (CH340 on COM17 this session). This is the first actual hardware run of
the `esp32-s3-schoolbell-prov` build from the "Provisioning Pilot Update"
entry below — everything in that entry up to this point had been
build-verified only.

**Confirmed working, end to end, on real hardware:**
- Flashed `esp32-s3-schoolbell-prov` (via a no-space mirror build, upload
  itself is a plain `esptool` write and works fine directly from this repo's
  own path — only the build/link step needs the mirror, see the build note
  below).
- NVS Wi-Fi credentials survive a flash unchanged (same partition table) —
  confirmed the device just reconnected to its existing network first,
  correctly skipping provisioning entirely (Section 3 Phase 0 working as
  designed).
- Cleared Wi-Fi via `PUT /api/v1/config {"wifi":{"ssid":"","password":""}}`
  on the still-live control panel, then reset. Full boot log confirmed:
  - `JenixProvisioning: Using persisted first-boot Proof-of-Possession` —
    PoP persistence across boots works.
  - BLE/NimBLE stack initializes cleanly alongside the existing SoftAP
    control panel (`wifi:mode : softAP` at 192.168.4.1, `Setup AP ready:
    JENIX-SCHOOL-BELL`) with no crash or resource conflict observed.
  - `wifi_prov_mgr: Provisioning started with service name : JNXSB95A458`
    and `JenixProvisioning: Provisioning started, service name=JNXSB95A458`
    — the standard `JNX{code}{6-hex-MAC}` name, live, matching Section 2
    exactly.
  - `LogService: ... provisioning :: BLE Security Scheme 2 provisioning
    started` confirms the full integration chain (`app_main.cpp` →
    `ProvisioningService` → `jenix_provisioning` component →
    `wifi_prov_mgr`) works together on real silicon.
  - Found and fixed a real gap while doing this: the PoP was only ever
    printed to Serial on first-ever generation, not on later boots while
    still unprovisioned — useless for a bench operator who missed that one
    boot. `jenix_provisioning.cpp` now prints a standardized
    `[FACTORY] pid=... ble_name=... pop_username=... pop=...` line every
    time provisioning starts, whether the PoP was just generated or loaded.
    Captured PoP for this unit: `2NGBV7NDDAHH` (username `jenix`).

**Not yet done:** actual phone-side BLE pairing through the Jenix One app
(no phone in this session) — the device is currently sitting in
provisioning mode, offline from its home Wi-Fi, advertising as
`JNXSB95A458`, waiting for that pairing. Restoring it needs either that app
pairing to complete, or someone with Wi-Fi-capable hardware joining its
`JENIX-SCHOOL-BELL` AP hotspot and posting the SSID/password to the control
panel directly — this machine has neither Wi-Fi nor Bluetooth hardware, so
neither path is possible from here.

**Factory flash tool**: registered as `JNX-SB-S3-01` in the shared tool at
`IOT_Device/QRunlock/FlashTool/` (PROVISIONING.md Section 8a's "shared, not
per-device copies" principle applied to tooling too) — see
`../FlashTool/README.md` (sibling of this `firmware/` folder) for the local
launcher. `capture.py` there was generalized to recognize the new
`[FACTORY]` line format (in addition to QRunlock/Token Dispenser's own
pre-existing format) and to not require their local-API-token field, which
School Bell's firmware doesn't have.

**Build note**: same two path-related issues as the "Provisioning Pilot
Update" entry below — building/uploading from this repo's own path directly
works for upload (plain esptool write) but not for a build that needs the
vendored `esp_audio_codec` linker fix; the flash tool's own build step
inherits that limitation too until either that vendored bug is fixed or it's
run from a no-space mirror, same as `pio run` itself.

---

# Soft PTT Bench Validation — 2026-09-11

Tested from a browser WebSocket client (Jenix One platform session, not the
APK) directly against the live unit's `/api/v1/announcement/ws` at its LAN
IP, following `SOFT_PTT_CONTRACT.md` exactly, no wired/serial access this
session. Result: **passes, end-to-end, on real hardware** — resolves the
soft-PTT half of the "Open Risks" line below.

- `start` → device replied
  `{"type":"ready","format":"pcm_s16le","sample_rate":22050,"channels":1}`
  in ~110ms.
- Streamed a synthetic 440 Hz tone as raw 16-bit PCM frames (40ms/frame,
  22,050 Hz mono, per contract) for ~2s — user confirmed hearing it play
  through the physical PCM5102/speaker, so this is real audio through the
  live path, not just a protocol handshake.
- `stop` → device replied `{"type":"stopped"}` correctly.
- `GET /api/v1/announcement/status` afterward confirmed a clean return to
  idle: `announcement_active:false`, `soft_ptt_active:false`,
  `announcement_source:"none"`, no stuck/busy state.

Not tested: **physical PTT** (GPIO15) — needs someone at the bench to short
it to GND, not doable remotely. Also not tested: real microphone input
(this used a synthetic tone, not a live mic), the actual APK client, or
mouth-to-speaker latency against the contract's <150ms target.

---

# Provisioning Pilot Update — 2026-09-11

Context: `../../PROVISIONING_PARITY_MASTER_PROMPT.md` and
`../../../../PROVISIONING.md` Sections 8a/11 — School Bell had no BLE stack
and a fixed, un-secured SoftAP setup scheme, so no real unit could be
onboarded through the Jenix One app. This pass built the shared
`jenix_provisioning` component (`IOT_Device/_shared/jenix_provisioning/`,
Security Scheme 2 over BLE) and wired School Bell as its first consumer, in
a brand-new `esp32-s3-schoolbell-prov` PlatformIO env that **does not touch**
the shipping `esp32-s3-schoolbell` env — same board/platform/partitions, the
component and the standard `JNXSB{6-hex-MAC}` naming only take effect under
that env's `JENIX_PROV_STANDARD` build flag. No physical hardware access
during this pass, so this is build-verified only (both envs compile AND
link cleanly — see below), not bench-tested.

**Build verification note**: this checkout's own path
(`D:\IOT Device\...\Smart School Bell\...`) has two independent, pre-existing,
provisioning-unrelated build breaks caused by spaces in the path, neither
introduced by this pass:
1. `-fmacro-prefix-map=<project>=` breaks `cc1plus` on every source file —
   fixed for real by adding `# CONFIG_COMPILER_HIDE_PATHS_MACROS is not set`
   to `sdkconfig.defaults` (same fix QRunlock's own `sdkconfig.defaults`
   already documents and applies for the identical symptom).
2. `managed_components/espressif__esp_audio_codec/CMakeLists.txt`'s
   `target_link_libraries(... "-L ${CMAKE_CURRENT_SOURCE_DIR}/lib/...")`
   breaks at final link (`-L` argument gets space-split, library not found,
   `undefined reference to esp_mp3_dec_register` etc.) — this is a bug in
   the *vendored* component-manager package, not something to patch in a
   gitignored `managed_components/` tree. **Not fixed**, worked around only:
   verified both envs by building from a no-space mirror
   (robocopy of this tree, preserving the same relative depth to
   `IOT_Device/_shared/`), which is consistent with how this firmware has
   actually always been built per this file's own history (the
   `0.6.2-sd-stat-fix` build/flash above ran from
   `C:\Users\User\.codex\memories\jenix-schoolbell-fw-preview-fix-20260910`,
   not this path). Both envs link clean from a no-space path:
   `esp32-s3-schoolbell` 56.0% flash / 13.5% RAM (matches the
   `0.6.2-sd-stat-fix` figures above almost exactly — zero regression);
   `esp32-s3-schoolbell-prov` 64.1% flash / 16.5% RAM.
   Building/flashing for real bench validation (item 1 below) needs either
   the same no-space-mirror approach or a real fix to the vendored `-L`
   flag issue.

**Done:**
- `IOT_Device/_shared/jenix_provisioning/` — shared ESP-IDF component,
  `wifi_provisioning` + `protocomm`, Security Scheme 2 (SRP6a/AES-256-GCM),
  parameterized by product code / PID / PoP source, generalized from
  QRunlock's proven `BleProvisioningService.cpp` `EnsureSec2Material()`
  pattern. See its own `README.md`.
- Product code `SB` reserved in `PROVISIONING.md` Section 2.
- New `esp32-s3-schoolbell-prov` env (`platformio.ini`): pulls in the shared
  component through `components/jenix_provisioning/` — a thin
  forwarding-stub `CMakeLists.txt` (no duplicated source) that ESP-IDF
  auto-discovers with zero extra config, pointing at
  `IOT_Device/_shared/jenix_provisioning/`. (Originally tried
  `EXTRA_COMPONENT_DIRS` in the root `CMakeLists.txt` instead — reverted:
  this repo's space-containing path breaks ESP-IDF's
  `split_paths_by_spaces.py` heuristic once a second space-containing entry
  is added alongside PlatformIO's own `src` entry, confirmed 2026-09-11.)
  A conditional `REQUIRES` in `src/CMakeLists.txt` (gated on the
  `JENIX_PROV_STANDARD` cmake var, set only by this env's
  `board_build.cmake_extra_args`) is what actually pulls the stub into the
  build — the default env never references it. Plus `sdkconfig.prov.defaults`
  (BLE NimBLE + Security Scheme 2 Kconfig, merged only for this env via
  `SDKCONFIG_DEFAULTS`, not into the shared `sdkconfig.defaults`).
- `include/services/provisioning_service.h` / `src/services/provisioning_service.cpp`
  — thin wrapper service (matches the existing `WifiService`/`CloudService`
  pattern); always compiles in both envs, only does anything under
  `JENIX_PROV_STANDARD`.
- `app_main.cpp`: after `wifi_service_.init()`, if
  `!wifi_service_.hasStationConfig()` (Section 3 Phase 0), starts BLE
  provisioning. Already-provisioned units, and the default env entirely,
  are unaffected.
- `device_identity_service.cpp`: under `JENIX_PROV_STANDARD` only, device id
  becomes the standard `JNXSB{6-hex-MAC}` (was `JNX-SB-S3-{mac}`). Confirmed
  no backend/app code depends on the old device-id-with-MAC format before
  doing this (only the unrelated PID string `JNX-SB-S3-001` appears
  elsewhere, in `PWA_APK`'s `schoolBellPid.ts` — untouched by this rename).

**Explicitly not done — next steps, in order:**
1. ~~Hardware bench validation~~ — **done, 2026-09-12**, see the
   "Provisioning Hardware Validation" entry above: real unit flashed,
   advertises `JNXSB95A458` over BLE, PoP confirmed
   (`2NGBV7NDDAHH`/`jenix`). Only the actual phone/app-side pairing itself
   is still outstanding — needs a phone with the Jenix One app; open the
   Smart Mode / BLE provisioning screen, it should discover `JNXSB95A458`.
2. **SoftAP scheme** — only BLE is wired so far, matching QRunlock's own
   BLE-first rollout phasing. School Bell's existing AP control panel
   already owns the AP interface/HTTP server, so reconciling that with
   `wifi_provisioning`'s own SoftAP transport is a real design question to
   work out once BLE is proven, not before.
3. **Real platform bind** — `cloud_service.cpp`'s local-NVS `home_id` bench
   mechanism is untouched and still the only way `home_id` gets set. The
   real claim/bind REST contract isn't implemented anywhere in this repo
   yet (checked both `provisioningApi.ts` and QRunlock's
   `CloudBridgeService.cpp` — QRunlock has the identical open gap). Don't
   invent an endpoint here; this needs the platform side first.
4. **QRunlock refactor onto the shared component** — Section 8a's actual
   end state (QRunlock as a consumer, not the original). Deferred past
   item 1 above on purpose: QRunlock's `esp32-c3-supermini-prov2` env has
   its own unresolved Arduino-vs-ESP-IDF-5.3.1 build wall, unrelated to
   this work, and risky to touch without hardware to validate against.
5. Manufacturing-time PoP burn (both School Bell and QRunlock still use the
   first-boot-generate interim).

# Current Product Objective

Build a sellable Jenix SchoolBell appliance around `ESP32-S3 + SD + DS3231 +
PCM5102`, with the firmware staying deterministic and field-safe while a small
Node backend normalizes external audio sources into firmware-ready HTTP WAV
streams.

# Latest Update - 2026-09-11

- current built/flashed version: `0.6.2-sd-stat-fix`, local API `1.4`
- fixed the SD playback root cause: file-based `exists()` checks falsely
  rejected the FAT `/sdcard/bells` directory, leaving the audio manifest empty
  while the separate folder browser still showed all 68 files
- SD and internal-flash existence checks now use `stat()`, the Manual Bell UI
  retains the exact selected ID, and `bells/...` ring requests refresh the live
  SD manifest before playback
- hardware verification passed for `bells/00.mp3`: 44.1 kHz stereo, 220,500
  frames, 884,924 decoded PCM bytes, full-scale peak, `ESP_OK`, with audible
  PCM5102/AUX speaker output confirmed by the user
- required configuration and the default sound library now live on a new
  `6.8125 MiB` internal LittleFS partition; the appliance can boot and operate
  without an SD card
- added source-aware internal sound list/upload/delete/preview APIs; the existing
  `/sounds` response combines internal, optional SD and festival entries
- added the one-file `festival/current` MP3/WAV slot with guarded clear behavior
- added physical PTT on `GPIO15` with microphone input on `GPIO7` / `ADC1_CH6`
- added raw-PCM soft PTT over `/api/v1/announcement/ws`; the APK contract is in
  `SOFT_PTT_CONTRACT.md`
- bell playback now preempts physical or soft PTT, discards stale live frames,
  and lets an open announcement resume with current audio afterward
- `/bells` and its child folders are now recursively discovered as an SD audio
  library; path-based IDs allow duplicate filenames in different folders
- WebUI has a restricted `/bells` browser with folder navigation, phone
  preview, hardware selection and direct new-schedule assignment
- fixed the `/bells` Preview action falsely requesting a library refresh by
  caching the browser page entries for sound selection
- `GET /api/v1/sd/browse` is paginated and confined to `/bells`
- `GET /api/v1/sounds` includes `/bells` files and actual MP3/WAV duration
- stable device identity, platform PID, station IP and mDNS are exposed
- timezone and POSIX timezone can be changed and applied without reflashing
- canonical Jenix One MQTT status/LWT and OTA request/ack are implemented using
  the QRunlock platform contract; cloud binding remains local/manual because
  provisioning was explicitly deferred
- OTA partition slots and SHA-256 image verification are present
- build passed from
  `C:\Users\User\.codex\memories\jenix-schoolbell-fw-preview-fix-20260910`
  at 55.6% flash and 13.3% RAM
- after explicit user authorization, the full image was flashed successfully to
  the ESP32-S3 on COM30; all written image hashes verified
- serial boot confirmed app version `0.6.2-sd-stat-fix`, the `internal`
  LittleFS partition (`32768 / 7143424` bytes used), optional SD mount after the
  1-bit fallback, PCM5102, GPIO15/GPIO7 PTT, setup AP and mDNS startup
- because the partition table changed, first deployment must be a full wired
  flash; that first deployment is now complete on this device
- the SD MP3 hardware path is validated; internal sound CRUD, all-file batch
  compatibility, physical PTT, and real Wi-Fi soft-PTT latency remain to be
  bench-validated

# Audit Update — 2026-09-08

- audited the firmware, local pinout PDF, and all 68 files in `..\bells`
- moved DS3231 to right-header GPIO47/21 with optional SQW on GPIO2
- moved PCM5102 to adjacent left-header GPIO18/17/16
- added direct SD MP3 playback using pinned `esp_audio_codec` 2.6.2
- enabled FAT long filenames and UTF-8 for the supplied bell names
- added dynamic I2S rates, mono/stereo MP3, and 8/16-bit PCM WAV handling
- added `tools/prepare_sd_card.ps1` to copy the collection and generate a
  matching manifest
- backend tests pass; firmware compile passes from a no-space mirror
- no firmware was flashed; ask the user to connect and confirm the ESP32-S3
  before any upload or serial-monitor action
- full findings and unresolved field risks are in
  `FIRMWARE_AUDIT_2026-09-08.md`

# Current Date Anchor

- this handoff reflects project state as of `Friday, September 11, 2026`
- `IMPLEMENTATION_STATUS.md` and `FIRMWARE_TASKS_APK_INTEGRATION.md` were updated
  to the same firmware/API baseline

# Current Milestone

Milestone: `M3 Internal Storage + Festival + PTT Compile Validated`

Meaning:
- required local state and normal sound storage no longer depend on SD
- optional SD `/bells`, internal MP3/WAV and canonical HTTP(S) WAV remain
  available through reusable audio profiles
- festival and both PTT paths have concrete API/audio-service implementations
- the code compiles, but the changed partition table and new audio paths still
  need their first real-device validation

# Completed Through Today

Firmware baseline already completed before today:
- PlatformIO + ESP-IDF firmware scaffold
- RTC, SDMMC, LED, button, PCM5102 I2S, schedule, holiday, web, Wi-Fi, and
  logging service layers
- manual ring flow and basic schedule execution shell
- sample SD-card export pack
- compile validation from a no-space Windows mirror

Completed on `Thursday, August 13, 2026`:
- extended firmware config types with reusable audio profiles
- made `sounds_manifest.json` support:
  - old flat format
  - new `profiles` + `sounds` format
- refactored firmware audio playback into source dispatch logic
- preserved existing SD WAV playback behavior
- added real HTTP/VPS WAV playback in firmware
- updated sample manifest and firmware README for the new profile contract
- created a self-contained Node backend in `backend/`
- added backend profile CRUD and firmware-manifest helper endpoints
- added backend mic upload channel support for browser/app audio capture paths
- added backend stream planning for:
  - `youtube`
  - `url`
  - `vps`
  - `file`
  - `sip`
  - `rtp`
  - `browser-mic`
  - `app-mic`
- added backend tests for profile persistence and stream-plan generation

# What Is Real Right Now

Implemented with concrete code:
- firmware audio profiles in:
  - `include/app_types.h`
  - `src/services/config_service.cpp`
  - `src/services/audio_service.cpp`
- firmware HTTP streaming playback for canonical WAV over `http` / `https`
- backward-compatible SD manifest loading
- sample profile manifest in `tools/sample_export/sounds_manifest.json`
- standalone backend server in `backend/src/server.js`
- backend persistent JSON profile store at `backend/data/audio-profiles.json`
- backend uploaded mic storage under `backend/data/mic-channels/`
- firmware-manifest generation so the backend can emit firmware-ready profile
  snippets

Implemented but dependent on runtime tools or upstream feeds:
- YouTube source normalization requires `yt-dlp`
- all live normalization requires `ffmpeg`
- SIP is supported best through an external bridge process that emits audio to
  stdout
- RTP expects a reachable `rtp://...` input or readable SDP file

Not yet proven on real end-to-end runtime:
- live YouTube to WAV streaming on the backend
- live MP3 file normalization served to firmware
- live SIP audio bridging into the stream endpoint
- live RTP ingestion into the stream endpoint
- real phone-browser microphone upload and subsequent firmware playback
- real app-mic upload and playback
- hardware playback from the new HTTP stream path on the actual ESP32 bell box

# Tests Performed

Successful firmware verification on `Thursday, August 13, 2026`:
- `pio run`
- result:
  - direct build from the current repo path failed because ESP-IDF rejects
    project paths with spaces on Windows
  - build was re-run from a no-space mirror under:
    - `C:\Users\User\.codex\memories\jenix-schoolbell-fw-build-20260813-audio-profiles`
  - mirrored build completed successfully

Successful backend verification on `Thursday, August 13, 2026`:
- `node --test`
- result:
  - `3` tests passed
  - profile CRUD / manifest generation test passed
  - YouTube transcode-plan generation test passed
  - mic-upload transcode-plan generation test passed

Successful backend boot smoke test on `Thursday, August 13, 2026`:
- started `createSchoolBellMediaServer({ port: 0 })`
- server bound successfully and returned an ephemeral local port

Not performed in this session:
- flash of the new audio-profile firmware to real hardware
- real HTTP stream playback from the backend into the ESP32
- live ffmpeg runtime check against a real media URL
- live yt-dlp runtime check against a real YouTube URL

# Backend API Added Today

Implemented routes:
- `GET /health`
- `GET /api/audio-profiles`
- `POST /api/audio-profiles`
- `GET /api/audio-profiles/:profileId`
- `PATCH /api/audio-profiles/:profileId`
- `DELETE /api/audio-profiles/:profileId`
- `GET /api/audio-profiles/:profileId/firmware-manifest`
- `GET /api/mic-channels`
- `GET /api/mic-channels/:channelId`
- `PUT /api/mic-channels/:channelId/upload`
- `GET /streams/:profileId.wav`

Important backend behavior:
- firmware-facing output is always normalized to `wav`
- default output is `22050 Hz`, `mono`, `16-bit PCM`
- source metadata is stored locally in JSON, not a database
- no auth or tenant isolation exists yet

# Important Constraints

Firmware constraints:
- the firmware currently understands only:
  - `internal-flash` + `wav`
  - `internal-flash` + `mp3`
  - `sd-card` + `wav`
  - `sd-card` + `mp3`
  - `url` + `http|https` + canonical `wav`
  - `vps` + `http|https` + canonical `wav`
- the firmware directly decodes SD-card MP3, but does not negotiate SIP, speak
  RTP media, or pull YouTube URLs itself
- the firmware repository path still contains spaces, so local `pio run` from
  this exact working directory is not reliable

Backend constraints:
- `ffmpeg` must be installed and available in `PATH` unless `FFMPEG_BIN` is set
- `yt-dlp` must be installed for YouTube profiles unless `YT_DLP_BIN` is set
- SIP direct input through ffmpeg may work inconsistently depending on backend
  host environment; an explicit bridge process is the safer assumption
- mic uploads are stored on disk and are not rotated yet
- profile data is stored in a JSON file and is not concurrency-hardened for a
  multi-instance deployment

# Key Files Changed

Firmware files changed today:
- `README.md`
- `include/app_config.h`
- `include/app_types.h`
- `include/services/audio_service.h`
- `include/services/config_service.h`
- `src/app/app_main.cpp`
- `src/services/audio_service.cpp`
- `src/services/config_service.cpp`
- `tools/sample_export/sounds_manifest.json`

Backend files added today:
- `backend/package.json`
- `backend/README.md`
- `backend/src/config.js`
- `backend/src/index.js`
- `backend/src/server.js`
- `backend/src/lib/app-error.js`
- `backend/src/lib/http.js`
- `backend/src/audio-profiles/audio-profile.validation.js`
- `backend/src/audio-profiles/audio-profile.store.js`
- `backend/src/audio-profiles/audio-profile.service.js`
- `backend/src/mic-channels/mic-channel.service.js`
- `backend/src/streaming/transcode.service.js`
- `backend/test/audio-profile.service.test.js`
- `backend/test/transcode.service.test.js`

# Current Recommended Resume Order

1. Reconnect the phone to `JENIX-SCHOOL-BELL` and reload `192.168.4.1`.
2. Verify browser Preview and hardware playback across the
   paginated 68-file `/bells` collection.
3. Test internal MP3/WAV upload, phone preview, bell playback and guarded delete.
4. Verify operation with the SD removed, then reinsert it and power-cycle.
5. Bench-test GPIO15/GPIO7 physical PTT and bell preemption/resume.
6. Integrate the APK against `SOFT_PTT_CONTRACT.md` and measure Wi-Fi latency.
7. Then resume the existing URL/VPS/backend source validation and soak testing.

# Open Risks / Pending Work

- the new LittleFS partition is installed and mounted but its file operations
  still need UI-level testing
- the preview fix is flashed but still needs confirmation from the phone browser
- physical PTT has no real amplifier/microphone bench result yet; soft PTT's
  amplifier/Wi-Fi path is now bench-validated (see "Soft PTT Bench
  Validation — 2026-09-11" above) but not with a real microphone or the APK
- firmware HTTP playback has compile validation but not bench validation
- firmware still assumes canonical WAV input; no resampling fallback exists
- backend stream endpoints currently have no authentication or rate limits
- backend persistence is local JSON only
- no upload cleanup or retention policy exists yet
- no production deployment scripts exist yet for the new backend
- no UI exists yet for managing the backend profiles; API only

# Do Not Regress

- keep required configuration and the default sound library independent of SD
- keep SD WAV playback working for offline bell operation
- keep `/bells` browser entries selectable even when they were not part of the
  initial `/sounds` response
- keep one soft-PTT owner and bell-first audio priority
- keep backward compatibility for old flat `sounds_manifest.json` files
- keep firmware stream input limited to deterministic canonical WAV
- keep the backend as the place where format conversion complexity lives
- keep direct MP3 decode limited to SD-card files; do not move YouTube, SIP, or
  RTP complexity into the ESP32
- do not assume `pio run` from the current spaced project path is valid

# Short Resume Command Set

Firmware compile validation:
- mirror the repo to a no-space path before running `pio run`

Backend tests:
- `cd backend`
- `node --test`

Backend run:
- `cd backend`
- `npm start`

Health check:
- `GET http://127.0.0.1:4180/health`
