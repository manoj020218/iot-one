# Firmware Tasks - APK/Platform Integration Requests

Opened: 2026-09-10  
Last updated: 2026-09-11

All five device-side requests are implemented in firmware
`0.6.2-sd-stat-fix` / local API `1.4`. The full image and new partition
table were flashed to the ESP32-S3 on COM30 on 2026-09-10. Boot, LittleFS mount,
SD mount, PCM5102 initialization and physical-PTT initialization are confirmed.
On 2026-09-11 the FAT directory-detection defect was fixed and `bells/00.mp3`
was decoded and heard through the real PCM5102/AUX output.

## Task 1 - Internal-flash sound storage as a first-class source - DONE

Completed 2026-09-10:

- added a `6.8125 MiB` LittleFS partition named `internal`, mounted at `/flash`
- configuration, schedules, holidays, logs and the sound manifest now persist to
  internal flash, so normal operation no longer requires an SD card
- added list/upload/delete/preview endpoints under `/api/v1/internal/sounds`
- `GET /api/v1/sounds` remains the combined source-agnostic library and includes
  a `source` field for each entry
- the legacy `POST /api/v1/sd/upload` route remains an upload alias but stores
  new library sounds in internal flash
- the optional SD card remains mounted at `/sdcard`; `/bells` browsing and its
  68-file collection continue to work when a card is inserted

Important deployment note: this changes `partitions.csv`. The first install must
be a full wired flash that writes the partition table; application-only OTA
cannot create the new LittleFS partition.

## Task 2 - Temporary festival playback slot - DONE

Completed 2026-09-10:

- one replaceable MP3/WAV slot is stored as `festival/current`
- `GET /api/v1/festival` returns its metadata and preview URL
- `POST /api/v1/festival/upload` uploads/replaces the current slot
- `GET /api/v1/festival/content` streams it for preview
- `DELETE /api/v1/festival` clears it
- clear returns HTTP `409` while a schedule still references
  `festival/current`, preventing a silent broken schedule

## Task 3 - Hardware Push-to-Talk - DONE

Completed 2026-09-10:

- active-low PTT button: `GPIO15`
- analog microphone input: `GPIO7` / `ADC1_CH6`
- the PTT input reuses the shared active-low `ButtonDriver` helpers
- microphone PCM is DC-bias corrected and sent to PCM5102 at `22050 Hz`
- status reports the live announcement state and source

The electrical microphone level/gain and long-hold behavior still require a
real-board bench test.

## Task 4 - Soft Push-to-Talk contract and device endpoint - DONE

Completed 2026-09-10:

- WebSocket endpoint: `/api/v1/announcement/ws`
- format: raw signed 16-bit little-endian PCM, `22050 Hz`, mono
- explicit JSON `start` and `stop` messages; binary messages carry PCM frames
- recommended frame duration: `20-40 ms`; maximum frame size: `4096` bytes
- a `750 ms` idle watchdog stops an abandoned stream
- only one PTT source can own the live audio path at a time
- target LAN capture-to-output latency is under `150 ms`

The complete APK-facing wire contract is in `SOFT_PTT_CONTRACT.md`. APK capture,
resampling/framing and a real Wi-Fi latency test remain on the app/integration
side.

## Task 5 - Announcement priority behavior - DONE

Completed 2026-09-10:

- scheduled/manual bell playback owns the higher-priority audio path
- a bell can preempt either physical or soft PTT
- live PTT frames arriving during bell playback are discarded rather than
  delaying the bell or building an unsafe latency backlog
- the still-open PTT session resumes with current microphone audio after the
  bell releases the audio path

This is the practical implementation of pause -> bell -> resume for live audio:
the session remains active, while stale real-time frames are intentionally not
replayed.

## Remaining validation

- verify internal upload/preview/delete and a separate boot test without SD
- batch-verify the remaining 67 `/bells` files; browser enumeration of all 68
  and audible manual playback of `bells/00.mp3` are confirmed
- bench-test physical PTT input level and bell preemption
- integrate the APK WebSocket sender and measure real LAN latency
