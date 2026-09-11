# Plan 05: Execution Tracker

Last updated: 2026-08-02
Current milestone: `M1 Compile Validated`

## Purpose

This file is the resume-safe task tracker. Read it after
`IMPLEMENTATION_STATUS.md` whenever coding resumes after a power cut, restart,
or interrupted session.

## Milestones

`M0` Completed:
- create PlatformIO + ESP-IDF scaffold
- create module layout for app, drivers, services, and utils
- add sample SD export pack
- split planning into short resumable documents

`M1` Completed:
- run compile validation
- remove build errors
- confirm include and API correctness
- switch the build to the real EdgeHex N16R8 board profile
- switch SD handling from placeholder SPI assumptions to onboard SDMMC assumptions

`M2` Next:
- bench-validate locked board wiring
- validate LED, button, RTC, SD, and PCM5102

`M3` Runtime validation:
- validate config load
- validate schedule and holiday logic
- validate manual bell and WAV playback

`M4` Recovery hardening:
- add NVS-backed recovery markers
- define missed-bell policy
- harden restart behavior

`M5` Diagnostics hardening:
- finalize LED patterns
- improve log structure and retention policy
- expand HTTP status content carefully

`M6` Sync path:
- implement stable SD export contract fully
- add optional LAN pull sync later

`M7` Qualification:
- fault injection
- soak testing
- installer checklist

## Current Reality

Already present in codebase:
- app shell
- RTC, SD, PCM5102, LED, and button modules
- config, schedule, holiday, audio, log, Wi-Fi, sync, and web services
- sample JSON export files
- EdgeHex board-level SDMMC, button, LED, and I2C baseline
- copied local EdgeHex pinout PDF and board reference note
- locked DS3231 + PCM5102 pin map and dedicated wiring file

Still placeholder or not field-proven:
- real bench validation of the locked DS3231 + PCM5102 wiring
- production Wi-Fi behavior
- NVS recovery markers
- authenticated sync
- log rotation
- final diagnostics UX

## Resume Order

Always continue in this sequence unless blocked:
1. bench-check `WIRING_EDGEHAX_S3_DS3231_PCM5102.md` against the actual hardware
2. test SD on hardware
3. test RTC on hardware
4. test default SD bell WAV
5. test schedule minute execution
6. test holiday suppression
7. add recovery persistence
8. rerun `pio run` from a no-space build path after build-affecting changes

## Primary Files By Next Task

Compile cleanup:
- `platformio.ini`
- `src/app/app_main.cpp`
- `src/app/app_runtime.cpp`
- affected driver or service source

Pin validation:
- `include/board_pins.h`

Storage and config:
- `src/drivers/sd_driver.cpp`
- `src/services/storage_service.cpp`
- `src/services/config_service.cpp`

Time and recovery:
- `src/drivers/rtc_driver.cpp`
- `src/services/time_service.cpp`
- future NVS recovery module

Audio path:
- `src/drivers/pcm5102_i2s.cpp`
- `src/services/audio_service.cpp`

Schedule engine:
- `src/services/schedule_service.cpp`
- `src/services/holiday_service.cpp`
- `src/app/app_runtime.cpp`

## Work Rules

- keep every file at `<= 200` lines
- split by responsibility when growth appears
- do not guess hardware pin values
- do not add network write features before failure rules exist
- do not merge desktop app internals into firmware runtime

## Definition Of Done

The first device firmware is acceptable only when:
- it rings unattended without a PC
- it survives routine power cuts
- it prevents duplicate rings within the same minute
- it handles bad SD content predictably
- it exposes enough diagnostics for installer support
- it can be maintained through schedule/content updates
