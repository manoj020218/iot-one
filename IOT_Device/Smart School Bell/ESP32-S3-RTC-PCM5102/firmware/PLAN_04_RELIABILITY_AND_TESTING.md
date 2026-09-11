# Plan 04: Reliability And Testing

Last updated: 2026-08-01

## Reliability Goal

The school owner should experience the device as fixed infrastructure:
- install it
- set time and schedule
- replace content only when timetable changes
- otherwise leave it alone

That requires controlled behavior under power loss, bad media, and operator
mistakes.

## Power Recovery Rules

- boot must record that a restart occurred
- short power cuts must not create duplicate ringing
- invalid RTC or impossible system time must suppress auto bells
- recovery policy for missed bells must be explicit, not accidental
- after boot, the device should reach a known ready or fault state quickly

## Storage Reliability Rules

- SD reads must fail clearly
- writable files must be updated atomically
- logs must not grow forever without policy
- missing files must degrade in a documented way
- corrupted media must not crash the scheduler

## Time Reliability Rules

- validate RTC values before trusting them
- expose time-invalid state distinctly from storage fault state
- store timezone explicitly in config
- never make schedule decisions on unvalidated time

## Audio Reliability Rules

- normal bell tones and melodies must come from SD only
- invalid or missing SD bell file must fail loudly in logs and status
- volume defaults must be conservative
- playback should stop cleanly after requested sound ends
- repeated ring requests must not deadlock audio path

## Diagnostics Rules

The installer must be able to identify failures quickly using:
- LED patterns
- SD runtime log
- optional HTTP status endpoint

Minimum visible states:
- booting
- ready
- ringing
- degraded
- fatal fault

## Watchdog Strategy

First release should keep watchdog simple:
- enable task watchdog
- keep main loop bounded
- avoid blocking forever on I/O
- log watchdog-relevant stalls where practical

If concurrency increases later, watchdog ownership must be reviewed again.

## Security Rules

- no open write API by default
- any future sync write path must validate origin and payload
- no hard-coded production secrets in firmware source
- local diagnostics should expose minimal information needed for service

## Test Stages

### Compile Stage

- `pio run` succeeds
- no warning indicates obvious pin or API mismatch

### Bring-Up Stage

- LED responds to patterns
- button event durations are correct
- RTC read/write works
- SD mount works reliably
- default SD bell WAV plays through amplifier

### Functional Stage

- WAV playback works from SD
- schedule at a near-future minute rings once only
- holiday date suppresses ring correctly
- manual bell works while schedule engine is idle

### Fault Stage

- boot with missing SD
- boot with invalid JSON
- boot with missing sound file
- boot with invalid RTC time
- repeated power cuts around a scheduled bell minute

### Soak Stage

- long unattended run
- repeated daily bell sequence
- daily power-cycle test
- log review for drift, duplicates, or silent failures

## Installer Acceptance

Before shipment or installation:
- exact board pins are verified
- sample schedule and holiday pack is proven
- amplifier output level is documented
- service LED meanings are documented
- installer can diagnose the top failure modes without developer help

## First Sellable Firmware Gate

Do not call the product ready until:
- unattended ringing is stable for extended testing
- restart behavior is deterministic
- duplicate-bell prevention is proven
- corrupted content behavior is understood
- device can be updated by content replacement, not code changes alone
