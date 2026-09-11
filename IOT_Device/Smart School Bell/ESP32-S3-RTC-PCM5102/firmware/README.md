# Jenix SchoolBell Firmware

Standalone bell-runtime firmware for the ESP32-S3 + RTC + PCM5102 hardware box.

This firmware is intentionally scoped to the school bell appliance only:
- autonomous bell execution
- RTC-backed timekeeping
- 6.8 MiB internal LittleFS content/configuration storage with optional SD media
- PCM5102 AUX output to amplifier
- optional LAN diagnostics and sync later
- bell playback from SD MP3/WAV or normalized HTTP/VPS WAV profiles
- standalone functional WebUI for schedules, named timetable profiles,
  seasonal/exam date rules, holidays, presets, logs, automatic-bell pause/resume,
  Wi-Fi, RTC, internal/festival sound management, optional SD formatting,
  physical/soft PTT, volume, and manual bell testing
- versioned `/api/v1` contract shared by the WebUI and future Android APK

Teacher planning, parent portals, class/subject/room allocation, cloud
registration, and tunnels remain outside the embedded appliance. A future PWA
or APK can provide the richer UX by consuming the device's API v1 contract.

## Product Intent

This scaffold is being built as a long-life field device, not as a demo:
- fail-safe boot behavior
- explicit hardware validation points
- isolated services
- resumable implementation tracking
- deterministic storage and playback contracts

## Build

```powershell
cd "D:\IOT Device\IOT_Platform\jenix One\IOT_Device\Smart School Bell\ESP32-S3-RTC-PCM5102\firmware"
pio run
```

Build note:
- ESP-IDF does not tolerate project paths with spaces reliably on Windows.
- If this repository remains under `D:\IOT Device\...`, build from a no-space
  working copy or relocate the repo for compile tasks.

## Flash

```powershell
pio run -t upload
pio device monitor
```

## Current Status

Implemented in this scaffold:
- PlatformIO + ESP-IDF project structure
- service/driver/module boundaries
- DS3231-style RTC driver skeleton with I2C register access
- EdgeHex SDMMC SD-card mount layer
- internal LittleFS storage and SD-optional runtime
- PCM5102 I2S playback layer
- JSON-backed config/schedule/holiday/manifest services
- audio profile routing for internal/SD MP3/WAV and HTTP/VPS WAV sources
- one-file internal festival slot and raw-PCM WebSocket soft PTT
- application state machine and main loop shell
- resumable implementation tracker
- sample SD-card export pack
- EdgeHex `16MB` / `8MB PSRAM` board baseline and custom partition table

Still pending before field deployment:
- PCM5102 school-bell carrier pin verification
- real hardware bring-up on the target PCB
- LAN sync endpoint contract with desktop app
- long-run soak testing
- fault-injection testing
- production logging retention policy
- factory-reset and provisioning hardening

## Directory Layout

```text
firmware/
  include/                 Public headers for app, drivers, services, utils
  src/                     Firmware implementation
  test/                    Reserved for host and hardware tests
  tools/sample_export/     Reference SD-card content pack
  IMPLEMENTATION_STATUS.md Resume-first coding tracker
  SCHOOL_BELL_FIRMWARE_PLAN.md
  PLAN_01_*.md ... PLAN_05_*.md
```

## Optional SD Card

Normal installations do not require an SD card. Configuration, schedules,
holidays, logs and reusable uploaded sounds persist in internal LittleFS.

For a larger `/bells` collection, format the card as `FAT32` (not exFAT),
preferably using a Class 10 card. The
board pinout specifies support for cards up to 64 GB. Insert the card into the
computer, replace `E:\` below with its actual drive, and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\prepare_sd_card.ps1 -SdRoot E:\
```

The script copies every MP3/WAV from the sibling `bells` directory into
`sounds/`, generates a UTF-8 `sounds_manifest.json`, and copies the sample
device, schedule, and holiday files. Matching destination files are replaced.

## Audio Storage Contract

Implemented offline SD formats:

- MP3 Layer III, mono or stereo; the supplied collection's 24/44.1/48 kHz
  sample rates are selected automatically on I2S
- PCM WAV, 8-bit or 16-bit, mono or stereo, 8-96 kHz

HTTP/VPS playback remains deliberately normalized to PCM WAV, 16-bit,
22050 Hz, mono.

Bell audio rule:

- normal local tones live in internal flash and use `internal-wav` or
  `internal-mp3` profiles
- a large optional library can live recursively below SD `/bells`
- the temporary internal festival slot always has ID `festival/current`
- remote playback must be exposed as canonical WAV over HTTP(S)
- firmware should not embed normal school bell audio in flash

Current implemented audio profile sources:

- `internal-flash` with `format: wav|mp3`
- `sd-card` with `format: wav`
- `sd-card` with `format: mp3`
- `url` with `transport: http|https` and `format: wav`
- `vps` with `transport: http|https` and `format: wav`

Not implemented directly on-device:

- YouTube source extraction
- SIP ingest
- RTP ingest
- SIP/RTP media negotiation

For those sources, use an upstream gateway or VPS that converts them into a
plain HTTP(S) WAV endpoint for the firmware.

Persistent files are now on internal LittleFS:

- `device.json`
- `schedules.json`
- `schedule_profiles.json`
- `holidays.json`
- `bell_presets.json`
- `sounds_manifest.json`
- `sounds/*.mp3` and/or `sounds/*.wav`
- `festival/current.mp3|wav` (optional one-off slot)

The SD contract is only `/bells/**/*.mp3|wav`. The former
`POST /api/v1/sd/upload` route remains a compatibility alias but writes the
internal library. New clients should use `POST /api/v1/internal/sounds`.

Soft PTT uses `WS /api/v1/announcement/ws`; see
`SOFT_PTT_CONTRACT.md` for framing and latency requirements.

The manifest now supports reusable profiles:

```json
{
  "profiles": {
    "sd-default": {
      "source": "sd-card",
      "transport": "file",
      "format": "wav"
    },
    "sd-mp3": {
      "source": "sd-card",
      "transport": "file",
      "format": "mp3"
    },
    "vps-live": {
      "source": "vps",
      "transport": "http",
      "format": "wav",
      "endpoint": "http://example.com/audio/live-bell.wav"
    }
  },
  "sounds": {
    "default": {
      "profile": "sd-mp3",
      "file": "sounds/00.mp3",
      "duration": 5
    },
    "live-stream": {
      "profile": "vps-live",
      "duration": 8
    }
  }
}
```

The old flat manifest format is still accepted for backward compatibility.
See `tools/sample_export/`.

## Deployment Notes

The EdgeHex board baseline in `include/board_pins.h` now comes from the copied
pin PDF plus the proven FloodGuard firmware on the same board family.
The header-side wiring map is defined in
`WIRING_EDGEHAX_S3_DS3231_PCM5102.md`; it still requires bench validation on
the real board before field use.

Before the first real school installation:

1. validate RTC I2C pins
2. validate onboard SDMMC card mount
3. validate PCM5102 I2S pins
4. validate amplifier output level
5. validate power-cut recovery behavior
6. validate representative MP3 files at 24, 44.1, and 48 kHz plus `19-EGB.wav`
