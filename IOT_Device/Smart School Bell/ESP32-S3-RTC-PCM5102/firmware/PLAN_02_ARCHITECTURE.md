# Plan 02: Architecture

Last updated: 2026-08-01

## Design Principle

The firmware should read like a service appliance, not a student prototype.
That means small files, explicit responsibilities, and predictable runtime
transitions.

## Module Layout

Top-level modules:
- `src/app/`
  Orchestrates boot, loop, state transitions, and bell dispatch.
- `src/drivers/`
  Owns hardware interaction only.
- `src/services/`
  Owns business logic, data parsing, diagnostics, and transport shells.
- `src/utils/`
  Small helpers with no business ownership.
- `include/`
  Public interfaces and product constants.

## File Size Rule

Every file must remain at `<= 200` lines:
- easier hardware debugging in field support
- easier code review after interruptions
- lower chance of hidden coupling

If a file grows beyond the limit, split by responsibility, not by arbitrary
line count.

## Runtime Layers

### Drivers

Drivers should do only hardware work:
- `rtc_driver`
- `sd_driver`
- `pcm5102_i2s`
- `led_driver`
- `button_driver`

Drivers must not parse business JSON or make schedule decisions.

### Services

Services should own device behavior:
- `storage_service`
- `config_service`
- `holiday_service`
- `schedule_service`
- `time_service`
- `audio_service`
- `log_service`
- `wifi_service`
- `sync_service`
- `web_service`

Services may depend on drivers, but drivers must never depend on services.

### App Shell

`FirmwareApp` should remain the orchestrator only:
- initialize services in a safe order
- drive the main loop
- route manual ring events
- publish snapshot state to diagnostics

## Boot Sequence

Expected boot order:
1. initialize NVS
2. initialize LED and button
3. initialize SD storage
4. initialize logging
5. load config and manifests
6. initialize RTC and set system time
7. load holidays and schedules
8. initialize audio
9. initialize Wi-Fi if configured
10. initialize sync shell
11. start web diagnostics
12. enter ready loop

Any failure must either:
- move the device into degraded but observable operation, or
- stop automatic ringing and expose a fault pattern

## State Machine

Minimum states:
- `BOOTING`
- `STORAGE_FAULT`
- `TIME_FAULT`
- `READY`
- `RINGING`
- `DEGRADED`
- `FATAL`

State rules:
- no automatic ring from `BOOTING`
- no schedule execution when time validity is false
- ringing is temporary and returns to `READY` or `DEGRADED`
- unrecoverable init failures should not loop invisibly

## Main Loop

The main loop should stay simple:
- poll button events
- refresh time snapshot
- evaluate due schedules
- dispatch ring requests
- update LED pattern
- sleep on a short fixed interval

Later work may split this into tasks, but first release should prefer one
clear scheduler loop over premature concurrency.

## Recovery Ownership

Recovery responsibilities:
- `time_service` validates time
- `schedule_service` prevents duplicate minute execution
- `storage_service` handles atomic writes
- `log_service` records restart and fault evidence
- app shell decides whether missed-bell replay is allowed

## Hardware Abstraction Rules

`board_pins.h` is the only place for board pin ownership.

Rules:
- unknown pins must stay `GPIO_NUM_NC`
- never guess hardware pins in driver code
- product variants should branch through config headers, not scattered macros

## Diagnostics Model

Diagnostics outputs:
- LED patterns for field installer visibility
- log file on SD for post-fault review
- HTTP status endpoint for LAN service checks

Write operations over network should remain disabled until authentication,
integrity, and failure rules are defined.

## Future Extension Rules

Allowed future additions:
- authenticated LAN sync
- NVS-backed recovery markers
- RTC drift tracking
- watchdog metrics
- manufacturing self-test mode

Not allowed:
- mixing desktop-only logic into firmware
- large monolithic files
- hidden side effects in constructors
- cloud-first dependencies for basic ringing
