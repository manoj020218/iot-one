# Handoff

## Date

August 19, 2026

## Scope completed

- Wired successful relay activation to a dedicated LED confirmation sequence.
- Made the relay confirmation sequence the highest-priority LED pattern.
- Kept the confirmation pattern momentary and non-blocking.

## Relay trigger LED behavior

- The confirmation pattern now starts only after `relay_.Pulse(...)` succeeds.
- The sequence temporarily overrides every other LED state, including steady-on states.
- The sequence is intentionally short:
  - `50 ms` forced OFF
  - `80 ms` ON
  - `80 ms` OFF
  - `80 ms` ON
  - `50 ms` forced OFF
- Total override time is about `340 ms`, then the LED returns to the normal state pattern.

## Files touched for this fix

- `src/app/AppController.cpp`
- `src/status_led/StatusLedService.h`
- `src/status_led/StatusLedService.cpp`

## Validation

Verified on August 19, 2026:

- `pio run -e esp32-c3-supermini`
- Result: success
- RAM usage: `45844 / 327680` bytes (`14.0%`)
- Flash usage: `952290 / 1572864` bytes (`60.5%`)

Attempted on August 19, 2026:

- `pio test -e native`
- Result: not runnable on this Windows machine because `gcc` and `g++` are not installed in `PATH`

## Hardware check still required

- Trigger the relay from both button and RF paths.
- Confirm the LED shows two quick flashes even when the normal LED state is steady ON.
- Confirm the flashes are visible and brief, then the LED returns to the prior pattern.

## Git scope

- Intended git scope for this handoff is the `QRunlock` firmware files only.
- Unrelated repository changes outside this project folder were left out of this fix.
