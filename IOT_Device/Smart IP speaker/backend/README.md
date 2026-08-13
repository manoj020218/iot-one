# Jenix IP Speaker Backend

Backend package for the Jenix IP Speaker Tool. This is intentionally
structured as a product-specific module package, following the same pattern as
`IOT_Device/Smart Streamer/VPS`, so the main API server can mount it later
without tight imports into api-server internals.

## Exported Routers

- `createIpSpeakerRouter(deps)`
  Tenant-scoped resources for `/devices`, `/audio-assets`, `/groups`,
  `/announcements/recent`, and `/schedules`.
- `createIpSpeakerDeviceActionRouter(deps)`
  Device-scoped actions for `/:deviceId/speaker/...`, including announce,
  stop, volume, mute, unmute, and test-audio.

## What Is Implemented

- tenant-scoped router for:
  - speaker devices
  - audio library metadata
  - speaker groups
  - announcement schedules
- nested device-action router for:
  - `speaker.play`
  - `speaker.stop`
  - `speaker.volume.set`
  - `speaker.mute`
  - `speaker.unmute`
  - `speaker.test.audio`
- shared versioned speaker command envelope
- explicit announcement priority model
- per-device runtime state cache that never claims playback started before a
  device ack exists
- group command fanout with partial-failure reporting
- schedule CRUD with unique execution event IDs and manual execution support
- tests for group announce fanout and schedule duplicate-prevention

## Current Limits

- repositories are in-memory for this package pass
- no automatic scheduler worker integration yet
- no persistent audit store yet
- no device telemetry ack ingestion path yet

Those integration steps can happen after the package contract is accepted.

## Native Mount

This package is mounted into the main Jenix One API server as:

- tenant-scoped routes under `/api/v1/ip-speaker`
- device-scoped actions under `/api/v1/devices/:deviceId/speaker/...`
