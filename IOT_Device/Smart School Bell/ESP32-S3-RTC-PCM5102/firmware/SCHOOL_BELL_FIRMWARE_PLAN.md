# ESP32-S3 School Bell Firmware Plan

Last updated: 2026-08-01
Target: `jenix-schoolbell/ESP32-S3-RTC-PCM5102/firmware`

This root plan is now intentionally short. The original single-file plan was
split so every document stays below `200` lines and can be debugged, reviewed,
and resumed safely after a power cut or interrupted session.

## Product Intent

This firmware is for a dedicated bell appliance, not a hobby board demo:
- school owner should not need a PC running all day
- bell timing must survive short power cuts and routine reboots
- AUX output must cleanly drive an existing amplifier through PCM5102
- the device must fail predictably and visibly when storage or time is invalid
- schedule maintenance should stay simple for installer and school staff

## Scope

Current scope is limited to `School Bell` only:
- RTC-backed autonomous schedule execution
- SD-card based bell content and configuration
- WAV playback through PCM5102
- manual bell trigger from local button
- local diagnostics and optional LAN diagnostics

Out of scope for the first sellable firmware:
- attendance or classroom features
- arbitrary media player behavior
- cloud dependency
- remote control as the primary runtime path

## Read Order

When resuming work after any interruption, read in this order:
1. `IMPLEMENTATION_STATUS.md`
2. `PLAN_05_EXECUTION_TRACKER.md`
3. this file
4. the specific plan document for the task you are about to code

## Plan Set

The full firmware plan is now split into these files:

1. `PLAN_01_REQUIREMENTS.md`
   Defines field problem, product rules, functional scope, and acceptance goals.

2. `PLAN_02_ARCHITECTURE.md`
   Defines module boundaries, boot flow, state machine, and runtime design.

3. `PLAN_03_DATA_AND_SYNC.md`
   Defines SD-card contract, JSON models, sound rules, and later desktop sync.

4. `PLAN_04_RELIABILITY_AND_TESTING.md`
   Defines recovery, logging, watchdog, diagnostics, test gates, and security.

5. `PLAN_05_EXECUTION_TRACKER.md`
   Defines milestone status, next tasks, file ownership map, and resume steps.

## Non-Negotiable Engineering Rules

These rules apply to every coding session:
- keep each source and plan file at `<= 200` lines
- prefer explicit modules over large mixed files
- no hidden magic behavior during boot or bell playback
- every runtime fault must be either logged, surfaced by LED state, or both
- invalid time or invalid schedule data must suppress automatic ringing
- a missing SD sound asset must log and fail cleanly, not synthesize bell audio
- SD and RTC failure paths must be deterministic
- the firmware must be operable without internet

## System Summary

Primary hardware assumptions:
- ESP32-S3 main controller
- RTC on I2C, expected DS3231-compatible flow
- SD card on SPI or SDSPI
- PCM5102 DAC on I2S for line-level AUX output
- one service/reset button
- one status LED

Primary runtime services:
- storage
- configuration
- holidays
- schedules
- time
- audio
- logs
- Wi-Fi
- sync
- web diagnostics

## Current Build State

The repository already contains a real firmware skeleton:
- PlatformIO + ESP-IDF project scaffold
- app shell and runtime loop
- driver layers for RTC, SD, PCM5102, LED, and button
- services for schedules, holidays, audio, logs, Wi-Fi, sync, and web
- sample SD export pack
- compile-validated no-space Windows build path

This means planning is no longer the blocker. The next work is controlled
hardware bring-up, validation, and reliability hardening.

## Delivery Phases

Implementation is expected to move in this order:
1. compile and clean scaffold
2. verify exact board pins
3. prove SD, RTC, and PCM5102 on hardware
4. prove schedule execution and holiday suppression
5. harden power-loss recovery and diagnostics
6. add controlled desktop export and optional LAN sync
7. finish soak, fault, and installer-grade validation

Detailed checkpoints live in `PLAN_05_EXECUTION_TRACKER.md`.

## Immediate Next Actions

The next engineering steps from the current baseline are:
1. lock exact `board_pins.h` values for the real EdgeHex board
2. validate SD mount and JSON load on the target PCB
3. validate RTC read/write and time sanity rules
4. validate PCM5102 WAV playback from SD
5. rerun `pio run` from a no-space build path after build-affecting changes

## Success Definition

The firmware is only ready to sell when:
- it runs unattended in a school for long periods without operator babysitting
- power cycling does not create duplicate or missed bells without trace
- schedule changes are deterministic
- invalid storage or time faults are obvious to installer staff
- the school can use it as a fixed appliance instead of a computer workaround
