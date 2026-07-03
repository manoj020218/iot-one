# Jenix IoT Platform Progress

## Current Phase
- Phase name: Phase 15 - Queued Runtime Evaluation and Session Refresh
- Started: 2026-07-03
- Status: Completed

## Completed
- [x] Project planning tracker
- [x] Monorepo setup
- [x] Shared types
- [x] Auth backend
- [x] Login UI
- [x] Dashboard shell
- [x] Default HOME logic
- [x] PID backend model
- [x] PID admin UI
- [x] Device registry
- [x] BLE provisioning UI
- [x] AP provisioning UI
- [x] Provisioning state machine
- [x] Provisioning intent API integration
- [x] BLE quick-search scan path
- [x] Scene model
- [x] Scene engine
- [x] Manual scene run support
- [x] Scene builder UI
- [x] Scene telemetry runtime hook
- [x] Scene schedule runtime hook
- [x] Scene run history
- [x] Scene background scheduler
- [x] Device telemetry ingestion path
- [x] MongoDB-backed scene persistence
- [x] Distributed scheduler coordination
- [x] Home sharing
- [x] Settings pages
- [x] Device management page
- [x] Device detail page
- [x] Firmware update panel
- [x] Dynamic PID page renderer
- [x] User profile page
- [x] App update page
- [x] OTA by PID
- [x] API package model
- [x] Third-party API key management
- [x] Public API scope enforcement
- [x] Matter mapping
- [x] Matter readiness status
- [x] Matter bridge placeholder
- [x] Matter commissioning placeholder
- [x] PID MongoDB persistence
- [x] PID audit log persistence
- [x] Device MongoDB persistence
- [x] HOME MongoDB persistence
- [x] Provisioning MongoDB persistence
- [x] OTA MongoDB persistence
- [x] API package MongoDB persistence
- [x] API key MongoDB persistence
- [x] Server-authoritative HOME membership checks
- [x] Auth MongoDB persistence
- [x] Signed bearer auth middleware
- [x] PWA bearer-auth migration
- [x] Local session persistence
- [x] PWA token refresh rotation
- [x] Scene evaluation job queue
- [x] Scene runtime evaluation worker
- [x] Queue-backed scheduler runtime path
- [x] Queue-backed telemetry runtime path
- [x] Scene action dispatch queue
- [x] Scene action worker isolation
- [x] Unit tests
- [x] Regression tests

## Decisions
- Date: 2026-07-01
  Decision: Keep one root PNPM workspace while preserving `VPS/` and `PWA_APK/` as the primary work areas.
  Reason: It matches the project brief without losing the operational split you requested.
- Date: 2026-07-01
  Decision: Use a mock auth API contract in the PWA and typed Express auth routes in the API server until MongoDB-backed persistence is introduced.
  Reason: It allows Phase 2 UI and backend flows to stay modular, testable, and ready for later data integration.
- Date: 2026-07-01
  Decision: Enforce developer-only PID routes through explicit `x-role` and `x-actor-id` headers until the auth and RBAC stack is fully integrated.
  Reason: It preserves the developer-only rule for PID management without blocking Phase 3 on unfinished authentication middleware.
- Date: 2026-07-01
  Decision: Let the admin PID UI use the Phase 3 backend route contract first and fall back to a local demo store only when the backend is unavailable.
  Reason: It keeps the UI testable and navigable during frontend work without breaking the actual API integration contract.
- Date: 2026-07-01
  Decision: Use a real `/api/v1/devices` contract for the dashboard with a local demo fallback only when the device API is unavailable.
  Reason: It keeps the dashboard integration aligned to the backend contract while still allowing frontend work and tests to run independently.
- Date: 2026-07-01
  Decision: Keep Phase 6 provisioning backend-first, but allow local provisioning intent and device-demo fallback when BLE hardware access or API availability is missing.
  Reason: It preserves the real route contract while keeping the PWA flow testable in browser-only and CI environments.
- Date: 2026-07-01
  Decision: Port the FloodGuard BLE quick-search pattern into Jenix provisioning by preferring the native Capacitor Bluetooth LE plugin, using a two-pass scan strategy, and preserving a demo fallback when the plugin is unavailable.
  Reason: It matches the proven field behavior for fast device discovery without blocking browser-based development and tests.
- Date: 2026-07-01
  Decision: Start Phase 7 from shared contracts and backend execution rules before building the scene UI.
  Reason: It keeps trigger, condition, action, schedule, and permission semantics stable before the visual builder is added.
- Date: 2026-07-02
  Decision: Keep the PWA scene builder on the real `/api/v1/scenes` contract first, but add a local scene catalog fallback and local manual-run evaluator when the backend is unavailable.
  Reason: It preserves the production automation contract while keeping authoring, testing, and route coverage usable in browser-only and CI environments.
- Date: 2026-07-02
  Decision: Add schedule and device-threshold runtime evaluation as explicit API hooks before introducing a long-running scheduler or telemetry-consumer worker.
  Reason: It keeps Phase 7 testable and production-aligned while avoiding premature infrastructure coupling to MQTT, cron, or queue workers.
- Date: 2026-07-02
  Decision: Use an in-process scheduler loop and a direct device telemetry ingest route as the first production-grade runtime wiring for scenes.
  Reason: It turns Phase 7 into a functioning automation backbone immediately, while still leaving room to replace the transport and scheduling sources with MQTT workers or external jobs later.
- Date: 2026-07-02
  Decision: Persist scene records, scene audit logs, and scene run history in MongoDB behind a repository abstraction, while leaving a memory mode for tests and local fallback.
  Reason: It makes Phase 7 automation durable without coupling test runs or lightweight development flows to a live database.
- Date: 2026-07-02
  Decision: Coordinate scheduled scene execution with a MongoDB lease so only one API instance owns a scheduler tick at a time, while keeping a local coordinator for tests and single-node fallback.
  Reason: It removes the main multi-instance duplication risk without forcing an immediate move to a separate worker service.
- Date: 2026-07-02
  Decision: Model HOME access explicitly with `owner`, `admin`, `member`, and `viewer` roles, keep the PWA on the real `/api/v1/homes` contract first, and preserve a local fallback store for browser-only and API-unavailable runs.
  Reason: It makes shared access rules visible across dashboard, provisioning, and scenes immediately without blocking Phase 8 on full auth middleware or durable HOME persistence.
- Date: 2026-07-02
  Decision: Expose device-facing PID metadata at `/api/v1/pids/:pid`, add a lightweight firmware-request action on `/api/v1/devices/:deviceId/firmware/request`, and keep the PWA device center on those real contracts first with local fallback data when the API is unavailable.
  Reason: It enables Phase 9 device detail rendering and permission-aware firmware controls without prematurely coupling the UI to the full OTA release model planned for Phase 10.
- Date: 2026-07-02
  Decision: Model Phase 10 as a real OTA release catalog plus a separate third-party API access layer, then make the device firmware panel consume `/api/v1/devices/:deviceId/firmware-plan` so release compatibility comes from published OTA records instead of only PID firmware hints.
  Reason: It keeps OTA compatibility, API packaging, and public-scope enforcement aligned around PID and hardware revision while reusing the Phase 9 device detail surface.
- Date: 2026-07-02
  Decision: Implement Phase 11 Matter readiness as shared contracts plus placeholder backend routes and a device-detail status panel, while deferring live commissioner and bridge transport to a later integration pass.
  Reason: It adds Matter-aware product and device modeling now, keeps permissions and tests enforceable, and avoids pretending transport exists before the device/runtime layer is ready.
- Date: 2026-07-02
  Decision: Keep Matter runtime disabled by default behind `MATTER_RUNTIME_ENABLED=false` until vendor ID, CSA readiness, and a broader multi-product rollout are in place.
  Reason: It preserves the MQTT/VPS-side architecture work from Phase 11 without signaling that live Matter activation is ready before the commercial and certification prerequisites exist.
- Date: 2026-07-02
  Decision: Start the persistence-hardening phase with PID and device registry storage first, using the same repository-plus-driver pattern already proven in scenes.
  Reason: PID and device records sit underneath OTA, Matter, provisioning, and public API flows, so making them durable first reduces cross-module risk and keeps the later persistence passes more mechanical.
- Date: 2026-07-03
  Decision: Extend the repository-plus-driver pattern to HOME sharing, provisioning, OTA, and API access, then remove backend trust in `x-home-role` by resolving HOME membership server-side.
  Reason: Phase 13 needed durable collaboration and catalog data, and the role hardening only becomes reliable once membership state is authoritative and persistent.
- Date: 2026-07-03
  Decision: Move user-facing backend identity to signed bearer tokens, persist auth users and refresh sessions behind the same repository pattern, and isolate matched scene action delivery behind a claimed-job worker.
  Reason: Phase 14 needed production-grade identity trust and a real boundary between API request handling and runtime command dispatch without breaking the existing scene authoring and telemetry contracts.
- Date: 2026-07-03
  Decision: Split scene runtime into two worker stages by queuing telemetry and schedule evaluation jobs before scene execution, then let the existing action worker handle only post-match action delivery.
  Reason: Phase 15 needed the evaluation step itself off the API hot path, while still preserving the Phase 14 action-dispatch boundary and existing scene service semantics.

## Known Issues
- Issue: `pnpm.ps1` is blocked by local PowerShell execution policy.
  Impact: Workspace commands fail if launched through the PowerShell shim.
  Fix plan: Use `cmd /c pnpm` or run the approved `pnpm` command with escalation if sandbox access is required.
- Issue: The admin PID UI falls back to a local demo store when `/api/v1/admin/pids` is unavailable.
  Impact: Frontend development remains usable without the backend, but full multi-user consistency still depends on the live API.
  Fix plan: Remove or reduce the demo fallback once the backend is consistently available in development and staging.
- Issue: Provisioning currently simulates BLE scan discovery and AP hotspot progression instead of talking to real device transport layers.
  Impact: The onboarding UX, backend contracts, and dashboard integration are validated, but hardware commissioning is still a controlled abstraction.
  Fix plan: Replace the simulated BLE and AP transport services with native Android and live firmware-facing provisioning adapters in the device integration pass.
- Issue: Native BLE quick-search now supports the FloodGuard-style Capacitor plugin path, but the Android shell still depends on that plugin being present at runtime.
  Impact: Field builds can use the fast scan path, while browser-only runs still drop to the demo inventory.
  Fix plan: Wire the Android shell dependency and runtime packaging for `BluetoothLe` during the device-integration pass.
- Issue: Provisioning intent storage is still in-memory on the API side with a frontend fallback store when the API is unavailable.
  Impact: Cloud registration intent tracking works for development and tests, but not yet with durable operational history.
  Fix plan: Persist provisioning intents and status transitions in MongoDB and attach them to device lifecycle audit history.
- Issue: Scene runtime evaluation is now queue-backed, but most ingestion still reaches that queue through API-owned scheduler and telemetry endpoints rather than a live MQTT consumer.
  Impact: Evaluation no longer blocks the API request path, but the HTTP/API process still remains the main bridge for runtime event ingestion.
  Fix plan: Publish device telemetry and schedule-trigger events into the runtime queue from MQTT or a dedicated ingest worker so the API server is no longer the primary event source.
- Issue: Firmware requests now resolve against published OTA releases, but they still stop at queued intent instead of delivering binaries to real devices.
  Impact: Operators can select the correct PID/hardware-compatible target version, but rollout execution is still a controlled placeholder.
  Fix plan: Add the actual OTA delivery worker, device acknowledgement flow, and rollout state tracking when the firmware transport layer is introduced.
- Issue: Matter readiness, commissioning requests, and bridge sync state are currently placeholder flows backed by in-memory module state.
  Impact: Phase 11 models Matter capability, permissions, and UI entry points, but live Matter activation is intentionally disabled by default and still does not perform commissioner transport, gateway coordination, or durable Matter-state persistence.
  Fix plan: Keep the activation flag off until vendor ID and CSA readiness are complete, then replace the placeholder routes with live Matter transport integration and persist Matter runtime state alongside the broader MongoDB hardening pass.
- Issue: The PWA now auto-refreshes bearer sessions before expiry, but protected service calls do not yet retry once on 401 if a request races an expiry boundary.
  Impact: Rare edge requests can still fail if they leave just before a scheduled refresh completes.
  Fix plan: Add a protected fetch wrapper that performs one refresh-and-retry cycle for 401 responses on user-facing API calls.

## Next Tasks
1. Feed device telemetry and schedule events into the Phase 15 scene runtime queue from MQTT consumers or dedicated ingest workers.
2. Add a protected fetch wrapper with refresh-and-retry behavior for 401 race conditions.
3. Add real OTA rollout delivery, acknowledgement, and rollout-state persistence.
4. Replace the Phase 11 Matter placeholders with live commissioner, bridge, and device acknowledgement flows once the device/runtime integration layer is ready.

## Log
- 2026-07-01: Read `codex.md`, confirmed folder mapping, and created the initial project tracker.
- 2026-07-01: Started Phase 1 scaffolding for the PNPM monorepo foundation.
- 2026-07-01: Completed Phase 1 with passing `install`, `lint`, `typecheck`, `test`, and `build` validation.
- 2026-07-01: Implemented Phase 2 auth shells, default HOME logic, routed PWA login/dashboard flow, and auth API endpoints.
- 2026-07-01: Completed Phase 3 PID backend routes, validation, approval workflow, audit logging, and immutability tests.
- 2026-07-01: Completed Phase 4 PID admin UI routing, guarded pages, form validation, and backend-connected service layer.
- 2026-07-01: Completed Phase 5 device registry routes, dashboard device cards, PID-aware rendering, and rename flow integration.
- 2026-07-01: Completed Phase 6 provisioning entry flow, BLE and AP onboarding screens, provisioning intent API bridge, dashboard add-device access, and validation.
- 2026-07-01: Ported the FloodGuard-style BLE quick-search pattern into Jenix provisioning with native plugin detection, two-pass filtering, and quick-search UI support.
- 2026-07-01: Started Phase 7 with shared scene contracts, restricted-command rules, backend scene routes, manual run support, and tests.
- 2026-07-02: Completed the Phase 7 PWA scene catalog and scene builder UI with trigger, condition, action, schedule, and manual-test-run flows on the `/api/v1/scenes` contract.
- 2026-07-02: Added Phase 7 scene runtime orchestration hooks for device-threshold evaluation, schedule evaluation, and scene run-history retrieval on the API side.
- 2026-07-02: Wired Phase 7 runtime execution into an in-process scheduler loop and a device telemetry ingestion route so scenes can now fire automatically while the API server is running.
- 2026-07-02: Persisted scene records, audit logs, and run history in MongoDB with a repository abstraction, bootstrap wiring, and full workspace validation.
- 2026-07-02: Added Mongo lease-based scheduler coordination, local overlap protection, and multi-instance scheduler tests for Phase 7 runtime hardening.
- 2026-07-02: Completed Phase 8 HOME sharing with members, share codes, redeem flow, role-based access, dashboard and scene integration, and full workspace validation.
- 2026-07-02: Completed Phase 9 device management, device detail pages, firmware request panel, PID-driven dynamic page rendering, settings pages, and full workspace validation.
- 2026-07-02: Completed Phase 10 OTA release modeling, device firmware compatibility resolution, API package and key management, public API scope enforcement, and full workspace validation.
- 2026-07-02: Completed Phase 11 Matter readiness with shared Matter contracts, PID mode validation alignment, placeholder backend routes, restricted Matter command coverage, device-detail Matter UI, and full workspace validation.
- 2026-07-02: Completed Phase 12 core persistence baseline with MongoDB-backed PID records, PID audit logs, device records, bootstrap wiring, and full workspace validation.
- 2026-07-03: Completed Phase 13 with MongoDB-backed HOME, provisioning, OTA, and API access persistence, server-authoritative HOME membership checks, and full workspace validation.
- 2026-07-03: Completed Phase 14 with MongoDB-backed auth persistence, bearer-auth route migration, scene action worker isolation, and full workspace validation.
- 2026-07-03: Completed Phase 15 with queue-backed scene evaluation workers, automatic PWA bearer-session refresh, and full workspace validation.
