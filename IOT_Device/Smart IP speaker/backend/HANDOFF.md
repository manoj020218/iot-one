# Overall Product Objective
This workstream is for a sellable Jenix LAN IP Speaker Tool inside Jenix One,
not a standalone app. The backend must behave like a native product module
that reuses existing auth, device ownership, PID, OTA, and API server patterns.

# Repository / Branch
- Repository root: `D:/IOT Device/IOT_Platform/jenix One`
- Working area: `IOT_Device/Smart IP speaker/backend`
- Git branch: `main`

# Completed
- Created a self-contained backend package at `backend/` named
  `@jenix/ip-speaker-backend`.
- Added native product exports:
  `createIpSpeakerRouter(deps)` and `createIpSpeakerDeviceActionRouter(deps)`.
- Implemented tenant-scoped modules for:
  `devices`, `audio-assets`, `groups`, `announcements`, and `schedules`.
- Implemented device-scoped speaker actions for:
  `announce`, `stop`, `volume`, `mute`, `unmute`, and `test-audio`.
- Added a shared versioned speaker command envelope with the required command
  names and priority enum alignment.
- Added in-memory runtime tracking for per-device playback state, mute, volume,
  and current announcement.
- Added backend-side group fanout with per-device result reporting.
- Added schedule CRUD, execution history, and `executionKey`-based duplicate
  prevention for execute-now flows.
- Added native workspace/api-server integration:
  - workspace member: `IOT_Device/Smart IP speaker/backend`
  - tenant router mount: `/api/v1/ip-speaker`
  - device action mount: `/api/v1/devices/:deviceId/speaker/*`
- Added README and test harness for the backend package.

# Verified
- `cmd /c ..\\..\\node_modules\\.bin\\tsc --noEmit -p backend\\tsconfig.json`
  Passed on August 11, 2026.
- `cmd /c ..\\..\\node_modules\\.bin\\vitest run --config backend\\vitest.config.ts`
  Passed on August 11, 2026.
- `cmd /c pnpm --filter @jenix/ip-speaker-backend typecheck`
  Passed on August 13, 2026.
- `cmd /c pnpm --filter @jenix/ip-speaker-backend test`
  Passed on August 13, 2026.
- `cmd /c pnpm --filter @jenix/api-server typecheck`
  Passed on August 13, 2026.
- `cmd /c pnpm --filter @jenix/api-server test`
  Passed on August 13, 2026.
- Test coverage currently verifies:
  group partial-failure fanout handling and schedule duplicate execution
  prevention.

# Backend State
- `src/index.ts`
  Mount entrypoint exporting the tenant router and device-action router.
- `src/platform-deps.ts`
  Defines the injected platform contract so this package does not import
  `api-server` internals directly.
- `src/constants.ts`
  Defines internal key, PID prefix, default timezone, protocol schema version,
  and granular permission strings.
- `src/protocol/speaker-command.types.ts`
  Defines the shared speaker command envelope and command names.
- `src/devices/*`
  Lists speaker devices and returns speaker-specific device summaries with
  runtime state merged in.
- `src/audio-assets/*`
  Audio library metadata CRUD. Current implementation is metadata-only and
  in-memory.
- `src/groups/*`
  Speaker group CRUD with backend validation that target device IDs are actual
  IP Speaker devices in the current home.
- `src/announcements/*`
  Device/group announcement orchestration, per-device dispatch tracking,
  runtime-state updates, recent announcement listing, and device action routes.
- `src/schedules/*`
  Schedule CRUD, execution history, and execute-now orchestration with
  idempotency support.

# Frontend State
- No frontend work has been started in this package.
- The backend is mounted into the main API server and ready for the next
  phase: build the Jenix One UI screens against these routes.

# Protocol State
- Backend command names align with the TOOL master prompt:
  `speaker.play`, `speaker.stop`, `speaker.volume.set`, `speaker.mute`,
  `speaker.unmute`, `speaker.tone.play`, `speaker.status.get`,
  `speaker.config.get`, `speaker.config.set`, `speaker.reboot`,
  `speaker.ota.check`, `speaker.ota.apply`, and `speaker.test.audio`.
- The implemented control-plane routes currently dispatch:
  `speaker.play`, `speaker.stop`, `speaker.volume.set`, `speaker.mute`,
  `speaker.unmute`, and `speaker.test.audio`.
- Envelope shape is versioned with `schemaVersion`, `commandId`, `deviceId`,
  `type`, `issuedAt`, `expiresAt`, and `payload`.
- Runtime state deliberately distinguishes backend command acceptance from
  actual device playback by using `PENDING_DEVICE_ACK` instead of claiming
  `PLAYING`.

# Files Changed
- `backend/package.json`
- `backend/tsconfig.json`
- `backend/vitest.config.ts`
- `backend/README.md`
- `backend/HANDOFF.md`
- `backend/src/constants.ts`
- `backend/src/index.ts`
- `backend/src/platform-deps.ts`
- `backend/src/protocol/speaker-command.types.ts`
- `backend/src/audio-assets/audio-asset.controller.ts`
- `backend/src/audio-assets/audio-asset.model.ts`
- `backend/src/audio-assets/audio-asset.routes.ts`
- `backend/src/audio-assets/audio-asset.service.ts`
- `backend/src/audio-assets/audio-asset.types.ts`
- `backend/src/audio-assets/audio-asset.validation.ts`
- `backend/src/announcements/announcement.controller.ts`
- `backend/src/announcements/announcement.model.ts`
- `backend/src/announcements/announcement.routes.ts`
- `backend/src/announcements/announcement.service.ts`
- `backend/src/announcements/announcement.test.ts`
- `backend/src/announcements/announcement.types.ts`
- `backend/src/announcements/announcement.validation.ts`
- `backend/src/devices/device.controller.ts`
- `backend/src/devices/device.routes.ts`
- `backend/src/devices/device.service.ts`
- `backend/src/devices/device.types.ts`
- `backend/src/groups/group.controller.ts`
- `backend/src/groups/group.model.ts`
- `backend/src/groups/group.routes.ts`
- `backend/src/groups/group.service.ts`
- `backend/src/groups/group.types.ts`
- `backend/src/groups/group.validation.ts`
- `backend/src/schedules/schedule.controller.ts`
- `backend/src/schedules/schedule.model.ts`
- `backend/src/schedules/schedule.routes.ts`
- `backend/src/schedules/schedule.service.ts`
- `backend/src/schedules/schedule.test.ts`
- `backend/src/schedules/schedule.types.ts`
- `backend/src/schedules/schedule.validation.ts`

# Decisions
- Kept the package in the isolated `backend/` folder under the IP Speaker work
  area, but also added that folder as a real pnpm workspace member so
  `api-server` can consume it using the same package pattern as Smart
  Streamer.
- Used injected platform dependencies instead of importing `api-server`
  internals directly, matching the existing Smart Streamer package pattern.
- Kept persistence in-memory for the first backend pass so route and service
  contracts can be reviewed before database integration.
- Put group fanout and schedule execution orchestration in backend services so
  the browser never performs serial device command fanout.
- Added `executionKey` support to the execute-now route to support future
  scheduler worker idempotency without changing the API shape later.

# Next Recommended Steps
- Replace in-memory repositories with real persistence and audit storage.
- Add telemetry/ack ingestion so runtime state can progress from
  `PENDING_DEVICE_ACK` to `PLAYING`, `COMPLETED`, or `FAILED`.
- Add OTA, diagnostics, and network-settings modules after the core mount is
  accepted.
