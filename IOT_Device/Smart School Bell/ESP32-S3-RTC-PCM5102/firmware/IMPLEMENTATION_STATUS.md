# Firmware Implementation Status

> Update 2026-09-11: firmware `0.6.2-sd-stat-fix` / API `1.4` is built,
> flashed, and hardware-validated on COM30. Live serial capture identified the
> SD manual-ring failure: `StorageService::exists("/sdcard/bells")` reached an
> `fopen()`-based driver check, which falsely rejected FAT directories even
> though `/api/v1/sd/browse` could list all 68 files. Both storage drivers now
> use `stat()`, the WebUI preserves the exact selected `bells/...` ID, and ring
> requests refresh the live SD manifest before playback. Verified result for
> `bells/00.mp3`: 44.1 kHz stereo, 220,500 frames / 884,924 PCM bytes, peak
> 32,767, 80% volume, `ESP_OK`; audible output was confirmed by the user.

> Update 2026-09-10: firmware `0.6.0-flash-festival-ptt` / API `1.4` is
> compile-validated. It adds a `6.8125 MiB` internal LittleFS partition,
> SD-optional operation, internal sound management, a guarded one-file festival
> slot, physical PTT, the APK-facing soft-PTT WebSocket, and real bell-priority
> handling for both live announcement sources. The `/bells` browser preview
> selection bug is fixed by retaining paginated browser entries instead of
> requiring them in the initial sound-library response. The full image and new
> partition table were flashed successfully to the ESP32-S3 on COM30. Serial
> boot validation confirmed firmware version, LittleFS, SD, PCM5102, GPIO15 PTT,
> GPIO7 ADC microphone setup, Wi-Fi AP and mDNS initialization.

> Update 2026-09-08: direct SD MP3 playback, UTF-8 long filenames, grouped
> DS3231/PCM5102 header pins, and SD-card preparation tooling are now added and
> compile-validated. See `FIRMWARE_AUDIT_2026-09-08.md` and `HANDOFF.md` before
> relying on the older milestone details below.

Last updated: 2026-09-11
Project: Jenix SchoolBell standalone ESP32-S3 bell box

## Purpose

This file exists so development can resume safely after a power cut, machine
restart, or interrupted session without rediscovering project state.

Read this file first, then read:
- `PLAN_05_EXECUTION_TRACKER.md`
- `SCHOOL_BELL_FIRMWARE_PLAN.md`

## Current Milestone

Milestone: `M3 Internal Storage + Festival + PTT Compile Validated`

Meaning:
- the repository now has a real firmware project layout
- the codebase has compile-oriented module boundaries
- the runtime architecture is reflected in source files, not only in a plan
- the scaffold has passed `pio run` from a no-space Windows build mirror
- the next work should move into hardware bring-up and validation

## What Was Completed In This Session

- created PlatformIO + ESP-IDF scaffold
- added explicit product configuration and board pin headers
- added application state machine shell
- added RTC, SD, LED, button, and PCM5102 driver layers
- added services for config, schedules, holidays, time, audio, logs, Wi-Fi, sync, and web
- added sample SD-card export files
- updated firmware planning into short traceable documents
- preserved optional SD bell playback while moving required persistence and the
  default sound library to internal flash
- added explicit custom partition layout and completed compile validation
- adopted EdgeHex N16R8 board baseline from FloodGuard and switched SD to SDMMC
- copied the EdgeHex pinout PDF into the school-bell project root
- locked DS3231 + PCM5102 wiring and added a dedicated assembly wiring file
- added internal LittleFS storage and source-aware sound APIs
- added the guarded `festival/current` slot
- added physical and WebSocket soft PTT with bell priority
- fixed preview selection for paginated `/bells` browser results
- fixed FAT directory detection that prevented `/bells` entries from reaching
  manual/scheduled playback, and verified audible SD MP3 playback on hardware

## What Is Real vs Placeholder

Implemented with concrete code:
- file layout
- service interfaces
- DS3231-style RTC register access
- EdgeHex SDMMC mount path
- WAV parser and I2S streaming shell
- internal-flash and optional-SD bell audio contract
- schedule/holiday JSON parsing
- manual ring flow from button/app shell
- HTTP status/manual-ring endpoint shell
- EdgeHex board reference note and local pin PDF copy

Still placeholder or only partially hardened:
- bench validation of locked DS3231 + PCM5102 wiring on the real bell box
- Wi-Fi production behavior
- LAN authentication hardening
- missed-bell recovery persistence in NVS
- checksum-driven sync flow
- long-run log rotation
- first-install wired flashing and migration validation for the new partition table

## Build Notes

- the firmware now targets EdgeHex N16R8 with `16MB` flash and custom partitions
- the hardware baseline now targets EdgeHex N16R8 with onboard SDMMC
- the locked school-bell pin map sets DS3231 `SDA=GPIO47`, `SCL=GPIO21`, optional `SQW=GPIO2`; PCM5102 `BCK=GPIO17`, `LCK=GPIO18`, `DIN=GPIO16`
- ESP-IDF build tooling is unreliable from project paths containing spaces on Windows
- if build work resumes on this machine, use a no-space working copy for `pio run`
- compile validation succeeded from a no-space mirror on 2026-09-10
- flashed image usage is `1,749,204 / 3,145,728 bytes` (`55.6%`) flash and
  `43,592 / 327,680 bytes` (`13.3%`) RAM

## Resume Order

When coding resumes, continue in this order:
1. obtain explicit permission, then perform a full wired flash so the new
   partition table is installed
2. verify LittleFS mount and boot without an SD card
3. test internal upload, preview, delete and playback
4. verify the 68-file optional-SD `/bells` browser, preview and playback
5. bench-verify RTC, PCM5102, physical PTT and bell preemption
6. integrate and latency-test the APK soft-PTT WebSocket sender
7. validate scheduler timing, holiday suppression and power-cut recovery
8. execute soak and fault testing

## High-Risk Areas

These are the first things to inspect if behavior is unstable:
- `include/board_pins.h`
- `src/drivers/sd_driver.cpp`
- `src/drivers/rtc_driver.cpp`
- `src/drivers/pcm5102_i2s.cpp`
- `src/services/audio_service.cpp`
- `src/app/app_main.cpp`
- `src/app/app_runtime.cpp`

## Field-Reliability Checklist

This must be true before calling the product field-ready:
- power-cut recovery tested repeatedly
- RTC keeps correct date/time after full power removal
- SD card corruption behavior is understood
- every missing/corrupt file fails predictably
- amplifier output level is stable and clean
- manual ring always works
- no bell duplicates within the same minute
- boot-to-ready time is measured
- all runtime faults are logged and observable

## Definition Of Done For First Sellable Firmware

The first device build is acceptable only when:
- it rings for 30 consecutive days without operator babysitting
- it survives daily power cycling
- schedule changes are deterministic
- RTC drift and time validation are understood
- the school can replace internal or optional-SD content without reflashing firmware
- the installer can diagnose fault state from LED/log behavior alone

## Planning Files

The monolithic firmware plan was split to keep every file short and resumable:
- `SCHOOL_BELL_FIRMWARE_PLAN.md`
- `PLAN_01_REQUIREMENTS.md`
- `PLAN_02_ARCHITECTURE.md`
- `PLAN_03_DATA_AND_SYNC.md`
- `PLAN_04_RELIABILITY_AND_TESTING.md`
- `PLAN_05_EXECUTION_TRACKER.md`
