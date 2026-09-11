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
- physical and soft PTT have no real amplifier/microphone/Wi-Fi bench result yet
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
