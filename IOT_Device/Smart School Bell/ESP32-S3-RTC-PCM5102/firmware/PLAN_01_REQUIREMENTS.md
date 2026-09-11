# Plan 01: Requirements

Last updated: 2026-08-01

## Field Problem

The current school setup depends on a computer remaining powered on for bell
automation. That is not acceptable for a long-life appliance product because:
- staff may shut down the PC after office hours
- Windows updates, crashes, or operator mistakes can stop bell service
- a public computer is not a reliable clock source
- the school owner wants a fixed box that behaves like electrical equipment

The firmware must turn the ESP32-S3 unit into a dedicated bell appliance.

## Product Goal

Build a standalone bell box that:
- stores schedule and sound metadata locally
- keeps time with RTC even when mains power is removed
- plays bell audio through PCM5102 AUX output to an existing amplifier
- rings automatically with no always-on PC requirement
- remains diagnosable by an installer with simple tools

## Scope For First Sellable Firmware

Included:
- automatic school bell by date, day, and time
- holiday suppression
- manual bell trigger
- SD-card based sound and schedule content
- RTC-based timekeeping
- local logs and visible fault status
- optional local HTTP diagnostics on LAN

Excluded:
- multi-room paging
- cloud dependence
- user accounts on the device
- generic media playback features
- OTA as a launch blocker

## Product-Grade Rules

This is a field appliance, so these rules are mandatory:
- boot must be deterministic
- no feature may require internet for normal ringing
- every critical dependency must have an explicit failure mode
- corrupted SD content must not crash the runtime
- invalid time must stop automatic ringing until corrected
- one bad sound file must not destroy the schedule engine
- duplicate bell execution inside the same minute must be blocked
- manual ring must work even if schedule sync is unavailable

## Functional Requirements

### Time

- read primary time from RTC at boot
- validate year, month, day, hour, and minute ranges
- allow system clock refresh from RTC
- keep schedule decisions based on local timezone

### Scheduling

- support weekday-based schedules
- support per-entry bell time in `HH:MM`
- support sound identifier mapping
- support enable/disable per schedule entry
- suppress bells on configured holidays

### Audio

- play SD-hosted bell sounds through PCM5102
- support one canonical audio format for first release
- default to `16-bit`, `22050 Hz`, `mono`, `WAV`
- keep all normal bell melody and tone assets on SD card only

### Local Operation

- service button short press triggers manual bell
- long press enters service or provisioning behavior later
- LED must show boot, ready, warning, and fault patterns
- runtime logs must be written to SD when storage is healthy

### Content Management

- schedule pack must be replaceable from SD export/import
- school should not need to reflash firmware for timetable updates
- sound asset references must be resolved through a manifest, not hard-coded
- missing bell audio on SD must be treated as a visible fault, not replaced by firmware audio

## Installer Requirements

- device must be mountable near amplifier rack
- AUX output level must be predictable and documented
- installer must be able to confirm RTC, SD, and audio health quickly
- service behavior must not depend on keyboard, monitor, or OS login

## Power Failure Requirements

- short power loss must not corrupt bell state
- reboot after power return must be fast
- firmware must remember enough state to avoid accidental duplicate ringing
- missed-bell policy must be explicit and logged

## Safety Requirements

- no uncontrolled looping bell on boot
- no silent success when core hardware is missing
- invalid config must move device to safe degraded mode
- button actions must require deliberate press durations

## Security Requirements

- LAN diagnostics must be read-only by default
- any future write endpoint must require authentication
- never expose filesystem write access casually over network
- no cloud token should be required for school bell operation

## Acceptance Gates

The product is not ready for school installation until all are true:
- automatic bell works from RTC time without a PC
- holidays suppress bells correctly
- manual bell works reliably
- SD replacement path is deterministic
- logs and LED patterns make fault states understandable
- at least one soak run proves long unattended operation

## Open Assumptions To Resolve

These are not planning issues anymore; they are validation tasks:
- exact RTC part and address on the EdgeHex board
- exact I2C, SPI, and I2S pin map
- amplifier input sensitivity and required output level
- required boot-to-ready time for school use
- whether LAN diagnostics ships enabled or installer-enabled only
