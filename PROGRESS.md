# Jenix IoT Platform Progress

## Current Phase
- Phase name: Phase 10 - OTA and Third-Party API
- Started: 2026-07-02
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
- [ ] Matter mapping
- [x] Unit tests
- [ ] Regression tests

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

## Known Issues
- Issue: `pnpm.ps1` is blocked by local PowerShell execution policy.
  Impact: Workspace commands fail if launched through the PowerShell shim.
  Fix plan: Use `cmd /c pnpm` or run the approved `pnpm` command with escalation if sandbox access is required.
- Issue: Auth persistence is currently mock-backed and not yet connected to MongoDB.
  Impact: Login and signup flows validate architecture and tests, but not final production persistence.
  Fix plan: Replace the mock session generation with database-backed auth and refresh-token storage during the next auth-hardening pass.
- Issue: PID storage and audit logs are currently in-memory inside the API server module.
  Impact: Phase 3 behavior is validated and testable, but PID data is not yet durable across process restarts.
  Fix plan: Replace the in-memory repository with MongoDB collections `product_pids` and `pid_audit_logs` during the persistence pass.
- Issue: The admin PID UI falls back to a local demo store when `/api/v1/admin/pids` is unavailable.
  Impact: Frontend development remains usable without the backend, but full multi-user consistency still depends on the live API.
  Fix plan: Remove or reduce the demo fallback once the backend is consistently available in development and staging.
- Issue: The device registry is still in-memory on the API side and uses dashboard-side demo fallback when the API is unavailable.
  Impact: Device cards and rename flows are fully wired, but device persistence is not durable yet.
  Fix plan: Move device records to MongoDB and reduce dashboard fallback use once the backend environment is stable.
- Issue: Provisioning currently simulates BLE scan discovery and AP hotspot progression instead of talking to real device transport layers.
  Impact: The onboarding UX, backend contracts, and dashboard integration are validated, but hardware commissioning is still a controlled abstraction.
  Fix plan: Replace the simulated BLE and AP transport services with native Android and live firmware-facing provisioning adapters in the device integration pass.
- Issue: Native BLE quick-search now supports the FloodGuard-style Capacitor plugin path, but the Android shell still depends on that plugin being present at runtime.
  Impact: Field builds can use the fast scan path, while browser-only runs still drop to the demo inventory.
  Fix plan: Wire the Android shell dependency and runtime packaging for `BluetoothLe` during the device-integration pass.
- Issue: Provisioning intent storage is still in-memory on the API side with a frontend fallback store when the API is unavailable.
  Impact: Cloud registration intent tracking works for development and tests, but not yet with durable operational history.
  Fix plan: Persist provisioning intents and status transitions in MongoDB and attach them to device lifecycle audit history.
- Issue: Scheduler leadership is now lease-coordinated across API instances, but execution still runs inside the API process instead of a dedicated worker.
  Impact: Duplicate leadership is controlled, but heavy automation volume still competes with API traffic and would benefit from queue-backed isolation at larger scale.
  Fix plan: Move schedule execution and high-volume telemetry-triggered automation to a worker or queue-backed runtime once deployment load justifies it.
- Issue: HOME sharing state, memberships, share codes, and audit records are currently in-memory on the API side.
  Impact: Phase 8 role management and share-code flows are functional and tested, but HOME collaboration data is not durable across process restarts.
  Fix plan: Persist HOME records, members, share codes, and access audit history in MongoDB during the broader persistence-hardening pass.
- Issue: Shared HOME access for scenes and devices currently trusts the session-provided `x-home-role` context instead of resolving membership on the backend from authenticated middleware.
  Impact: UI-visible role restrictions work for the current architecture, but final production RBAC still needs server-authoritative membership checks.
  Fix plan: Replace header-trusted HOME role context with authenticated membership resolution when the auth middleware and durable HOME repository are introduced.
- Issue: OTA releases, API packages, and third-party API keys are still in-memory on the API side.
  Impact: Phase 10 compatibility and scope enforcement are functional and tested, but release/package/key data is not durable across process restarts.
  Fix plan: Persist OTA releases, API packages, and issued API keys in MongoDB during the broader persistence-hardening pass.
- Issue: Firmware requests now resolve against published OTA releases, but they still stop at queued intent instead of delivering binaries to real devices.
  Impact: Operators can select the correct PID/hardware-compatible target version, but rollout execution is still a controlled placeholder.
  Fix plan: Add the actual OTA delivery worker, device acknowledgement flow, and rollout state tracking when the firmware transport layer is introduced.

## Next Tasks
1. Start Phase 11 Matter readiness on top of the PID-first OTA and public API foundations.
2. Move schedule execution and high-volume telemetry automation to a worker or queue-backed runtime when deployment load justifies process isolation.
3. Move PID, device registry, provisioning intent, HOME sharing, OTA release, and API access storage to MongoDB so the rest of the platform matches the scene durability baseline.

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
