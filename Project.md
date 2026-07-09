# Jenix IoT Platform Project Plan

## Project Snapshot

- Initialized: 2026-07-01
- Source brief: `D:\IOT Device\IOT_Platform\codex.md`
- Workspace root: `D:\IOT Device\IOT_Platform\jenix One`
- Current status: Phase 7 scene UI and runtime orchestration complete
- Current status: Phase 7 durable MongoDB-backed scene persistence complete
- Current status: Phase 7 distributed scheduler coordination complete
- Current status: Phase 8 home management and sharing complete
- Current status: Phase 9 settings and dynamic PID pages complete
- Current status: Phase 10 OTA and third-party API foundations complete
- Current status: Phase 11 Matter readiness complete
- Current status: Phase 12 PID and device persistence baseline complete
- Current status: Phase 13 extended persistence and RBAC hardening complete
- Current status: Phase 14 auth middleware and runtime isolation complete
- Current status: Phase 15 queued runtime evaluation and session refresh complete
- Current status: Phase 16 MQTT runtime ingress and delivery execution complete
- Current status: Phase 17 delivery acknowledgement and OTA dispatch persistence complete
- Current status: Phase 18 rollout status APIs and replay controls complete
- Current status: Phase 19 scene dispatch recovery UI complete
- Current phase: Phase 19 - Scene Dispatch Recovery UI

## Working Scope

- `VPS/` will be used for VPS-side work.
- `PWA_APK/` will be used for PWA and Android APK work.
- `IOT_Device/` will stay reserved for device-side and firmware-side assets unless a phase requires device contracts or provisioning payload examples.

## Proposed Repository Mapping

This mapping preserves the split you requested while still following the monorepo architecture from `codex.md`.

```text
jenix One/
  Project.md
  PROGRESS.md                      # to be created in Phase 1
  package.json                     # root workspace control
  pnpm-workspace.yaml
  tsconfig.base.json
  .env.example
  .gitignore
  README.md

  VPS/
    apps/
      api-server/
      admin-backend-ui/

  PWA_APK/
    apps/
      web-pwa/
      android/

  packages/
    shared/
    ui/
    device-schemas/

  IOT_Device/
    Tank Guard/
```

## Folder Ownership

| Area | Path | Responsibility |
| --- | --- | --- |
| VPS backend | `VPS/apps/api-server` | Node.js + TypeScript API, auth, PID, scenes, provisioning, MQTT, WebSocket |
| VPS admin UI | `VPS/apps/admin-backend-ui` | Developer-only PID management UI and backend operations UI |
| PWA | `PWA_APK/apps/web-pwa` | React + TypeScript mobile-first app hosted at `app.iotsoft.in` |
| Android APK | `PWA_APK/apps/android` | Capacitor wrapper and Android-specific integration for the PWA |
| Shared domain | `packages/shared` | Shared types, constants, schemas, API contracts, utilities |
| Shared UI | `packages/ui` | Reusable UI primitives for web-facing apps |
| Device schemas | `packages/device-schemas` | PID, telemetry, command, and Matter schema definitions |
| Device-side assets | `IOT_Device/` | Firmware references, product contracts, hardware-specific notes |

## Non-Negotiable Architecture Rules

- PID-first architecture is mandatory.
- No hardcoded product dashboards.
- Matter support must exist in the data model from the beginning.
- OTA must always be scoped by PID and hardware revision.
- BLE provisioning must remain abstract for future native Android integration.
- AP provisioning must always exist as a field-safe fallback.
- Shared access, scenes, OTA, PID approval, and device actions must be permission-checked and audit-logged.
- New modules are not complete without tests.

## Execution Strategy

### Phase 0 - Planning and Alignment

Status: Completed

- [x] Read external project brief
- [x] Inspect workspace layout
- [x] Identify existing top-level work folders
- [x] Create initial `Project.md`
- [x] Confirm final workspace mapping with user

### Phase 1 - Foundation

Status: Completed

Primary paths:
- `VPS/apps/api-server`
- `VPS/apps/admin-backend-ui`
- `PWA_APK/apps/web-pwa`
- `PWA_APK/apps/android`
- `packages/shared`
- `packages/ui`
- `packages/device-schemas`

Deliverables:
- [ ] Root PNPM workspace setup
- [ ] Root TypeScript base config
- [ ] Root lint, test, build, and typecheck scripts
- [ ] Root `.env.example`
- [ ] Root `.gitignore`
- [ ] Root `README.md`
- [ ] `PROGRESS.md`
- [ ] API server scaffold
- [ ] Admin backend UI scaffold
- [ ] Web PWA scaffold
- [ ] Android Capacitor scaffold placeholder
- [ ] Shared package scaffold
- [ ] UI package scaffold
- [ ] Device schema package scaffold

Validation gates:
- [ ] `pnpm install`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

### Phase 2 - Auth and Home Base

Status: Completed

Deliverables:
- [ ] Login UI shell
- [ ] Google login placeholder
- [ ] Facebook login placeholder
- [ ] Email login and signup UI
- [ ] Auth API module shell
- [ ] JWT access and refresh token structure
- [ ] Default HOME creation logic
- [ ] Dashboard layout shell

Validation gates:
- [ ] Login UI render tests
- [ ] Default HOME logic tests

### Phase 3 - PID Management Backend

Status: Completed

Deliverables:
- [ ] `product_pids` model
- [ ] PID validation
- [ ] PID create route
- [ ] PID edit route
- [ ] PID approve route
- [ ] PID audit log model
- [ ] PID immutability enforcement after approval

Validation gates:
- [ ] PID creation tests
- [ ] PID approval tests
- [ ] Locked field mutation rejection tests

### Phase 4 - PID Admin UI

Status: Completed

Deliverables:
- [ ] PID list page
- [ ] PID create page
- [ ] PID detail page
- [ ] PID edit page
- [ ] Matter mapping form
- [ ] API package form
- [ ] Dashboard template form
- [ ] Developer-only route guard

Validation gates:
- [ ] Form validation tests
- [ ] Role guard tests

### Phase 5 - Device Registry and Dashboard

Status: Completed

Deliverables:
- [ ] Device model
- [ ] Device registration flow
- [ ] Dashboard device grid
- [ ] Device rename flow
- [ ] Device status model
- [ ] PID icon rendering support

Validation gates:
- [ ] Device registration by PID tests
- [ ] Device card render tests

### Phase 6 - Provisioning UI

Status: Completed

Deliverables:
- [x] Provisioning entry page
- [x] BLE provisioning flow
- [x] AP provisioning flow
- [x] Provisioning progress state machine
- [x] Cloud registration intent API integration
- [x] Android BLE abstraction layer

Validation gates:
- [x] BLE screen render tests
- [x] AP form render tests
- [x] Provisioning state machine tests

### Phase 7 - Scene Pipeline

Status: Completed

Deliverables:
- [x] Scene model
- [x] Trigger selector
- [x] Condition builder
- [x] Action builder
- [x] Schedule builder
- [x] Scene catalog page
- [x] Manual test-run panel
- [x] Scene engine service
- [x] Manual scene run support
- [x] Device-threshold runtime hook
- [x] Schedule runtime hook
- [x] Scene run-history endpoint
- [x] Background scheduler bootstrap
- [x] Device telemetry ingest route
- [x] MongoDB-backed scene persistence
- [x] MongoDB-backed scene audit log persistence
- [x] MongoDB-backed scene run-history persistence
- [x] Mongo lease-based scheduler coordination

Validation gates:
- [x] Condition evaluation tests
- [x] Restricted command permission tests
- [x] Scene action builder tests
- [x] Scene runtime route tests
- [x] Scene scheduler tests

### Phase 8 - Home Management and Sharing

Status: Completed

Deliverables:
- [x] Home members model
- [x] Share code generation
- [x] Share code redeem flow
- [x] Permission selector
- [x] Access revoke flow
- [x] Owner/admin/shared/viewer distinction in UI

Validation gates:
- [x] Shared user permission tests
- [x] Expired code tests
- [x] Access revocation tests

### Phase 9 - Settings and Dynamic PID Pages

Status: Completed

Deliverables:
- [x] Device management page
- [x] Device detail page
- [x] Firmware update panel
- [x] Dynamic PID page renderer
- [x] User profile page
- [x] App update page

Validation gates:
- [x] Missing PID page fallback tests
- [x] Firmware action permission tests

### Phase 10 - OTA and Third-Party API

Status: Completed

Deliverables:
- [x] OTA release model
- [x] OTA compatibility resolution by PID
- [x] API package model
- [x] Third-party API key management
- [x] Public API scope enforcement

Validation gates:
- [x] Correct PID OTA selection tests
- [x] API scope enforcement tests
- [x] Wrong PID denial tests

### Phase 11 - Matter Readiness

Status: Completed

Rollout note:
- Phase 11 Matter work is limited to MQTT/VPS-side data modeling, PID mapping, readiness state, and guarded placeholder flows.
- Live Matter activation must stay disabled until the platform is ready with multiple products, vendor ID assignment, and CSA onboarding/certification readiness.

Deliverables:
- [x] Matter mapping model
- [x] Matter mode in PID model
- [x] Matter status on device detail page
- [x] Matter bridge placeholder
- [x] Matter commissioning placeholder

Validation gates:
- [x] Matter mode validation tests
- [x] Restricted Matter command tests

### Phase 12 - Core Persistence Baseline

Status: Completed

Deliverables:
- [x] PID repository abstraction
- [x] MongoDB-backed PID persistence
- [x] MongoDB-backed PID audit log persistence
- [x] Device repository abstraction
- [x] MongoDB-backed device persistence
- [x] Bootstrap wiring for PID/device persistence modes

Validation gates:
- [x] PID admin route regression tests
- [x] Device registry route regression tests
- [x] Workspace lint, typecheck, test, and build

### Phase 13 - Extended Persistence and RBAC Hardening

Status: Completed

Deliverables:
- [x] HOME repository abstraction
- [x] MongoDB-backed HOME persistence
- [x] MongoDB-backed HOME membership persistence
- [x] MongoDB-backed HOME share code persistence
- [x] MongoDB-backed HOME audit log persistence
- [x] Provisioning repository abstraction
- [x] MongoDB-backed provisioning intent persistence
- [x] OTA repository abstraction
- [x] MongoDB-backed OTA release persistence
- [x] API access repository abstraction
- [x] MongoDB-backed API package persistence
- [x] MongoDB-backed API key persistence
- [x] MongoDB-backed API key secret persistence
- [x] Server-authoritative HOME membership resolution for device access
- [x] Server-authoritative HOME membership resolution for scene access
- [x] Server-authoritative HOME membership resolution for Matter access
- [x] Server-authoritative HOME membership resolution for API key management
- [x] Bootstrap wiring for HOME/provisioning/OTA/API access persistence modes

Validation gates:
- [x] HOME route regression tests
- [x] Provisioning route regression tests
- [x] Device shared-role regression tests
- [x] Scene shared-role regression tests
- [x] Matter shared-role regression tests
- [x] API access regression tests
- [x] Workspace lint, typecheck, test, and build

### Phase 14 - Auth Middleware and Runtime Isolation

Status: Completed

Deliverables:
- [x] Auth repository abstraction
- [x] MongoDB-backed auth user persistence
- [x] MongoDB-backed refresh session persistence
- [x] Signed bearer access-token validation middleware
- [x] Request-auth user context plumbing
- [x] Backend user-facing route migration away from raw `x-user-*` identity headers
- [x] PWA bearer-auth migration for homes, dashboard, scenes, devices, and provisioning
- [x] PWA session persistence across reloads
- [x] Scene action dispatch queue
- [x] Scene action worker bootstrap
- [x] MongoDB-backed scene action dispatch persistence

Validation gates:
- [x] Auth route regression tests
- [x] Scene action worker tests
- [x] Workspace lint, typecheck, test, and build

### Phase 15 - Queued Runtime Evaluation and Session Refresh

Status: Completed

Deliverables:
- [x] Scene evaluation job repository abstraction
- [x] MongoDB-backed scene evaluation job persistence
- [x] Queue-backed telemetry scene evaluation
- [x] Queue-backed scheduled scene evaluation
- [x] Scene runtime evaluation worker bootstrap
- [x] Device telemetry response updated to return queue receipts
- [x] Scheduler updated to enqueue runtime jobs instead of evaluating inline
- [x] PWA refresh-token rotation support
- [x] PWA session storage metadata for refresh scheduling
- [x] PWA auth session refresh test coverage

Validation gates:
- [x] Scene runtime worker tests
- [x] Scheduler queue tests
- [x] PWA auth session refresh tests
- [x] Workspace lint, typecheck, test, and build

### Phase 16 - MQTT Runtime Ingress and Delivery Execution

Status: Completed

Deliverables:
- [x] MQTT runtime bridge binding
- [x] MQTT client bootstrap and topic subscription support
- [x] MQTT telemetry ingress message contract
- [x] MQTT schedule tick message contract
- [x] Scheduler publish boundary for schedule ticks
- [x] Device telemetry publish boundary for MQTT-first ingestion
- [x] MQTT consumer handlers for telemetry and schedule messages
- [x] Scene action worker MQTT command delivery
- [x] Firmware request MQTT OTA delivery publishing
- [x] MQTT runtime env and topic configuration

Validation gates:
- [x] Device telemetry MQTT ingress tests
- [x] Scene action MQTT delivery tests
- [x] Firmware MQTT OTA delivery tests
- [x] Workspace lint, typecheck, test, and build

### Phase 17 - Delivery Acknowledgement and Rollout Persistence

Status: Completed

Deliverables:
- [x] Scene action dispatch state extended with durable `dispatched` tracking
- [x] Scene command acknowledgement handler on MQTT runtime ingress
- [x] Scene command retry-on-timeout claim behavior
- [x] OTA delivery job repository abstraction
- [x] MongoDB-backed OTA delivery job persistence
- [x] Dedicated OTA delivery worker bootstrap
- [x] Firmware request route changed to queue OTA delivery jobs instead of direct publish
- [x] OTA acknowledgement and failure handling on MQTT runtime ingress
- [x] Device firmware version update on successful OTA acknowledgement
- [x] MQTT runtime env and topic configuration for delivery acknowledgements

Validation gates:
- [x] Scene action acknowledgement tests
- [x] Scene action retry tests
- [x] OTA delivery worker tests
- [x] OTA acknowledgement and firmware update tests
- [x] Workspace lint, typecheck, test, and build

### Phase 18 - Rollout Status and Replay Controls

Status: Completed

Deliverables:
- [x] Device firmware rollout history API
- [x] Device firmware rollout replay API for failed jobs
- [x] Scene dispatch history API
- [x] Scene dispatch replay API for failed jobs
- [x] Shared rollout and dispatch delivery contracts
- [x] PWA firmware rollout history panel on device detail pages
- [x] PWA failed-rollout replay action
- [x] Local fallback rollout ledger for browser-only and test runs

Validation gates:
- [x] Device firmware rollout route tests
- [x] Scene dispatch route tests
- [x] Device detail rollout UI tests
- [x] Workspace lint, typecheck, test, and build

### Phase 19 - Scene Dispatch Recovery UI

Status: Completed

Deliverables:
- [x] Operator-facing scene dispatch history panel on scene detail pages
- [x] PWA replay action for failed scene dispatch jobs
- [x] Scene dispatch refresh controls and status feedback on the scene operations surface
- [x] Local fallback scene dispatch ledger for browser-only and test runs

Validation gates:
- [x] Scene builder dispatch history UI tests
- [x] Web PWA lint, typecheck, test, and build

## Current Open Questions

- None at the planning level. Implementation issues will be logged here only if they block the phase.

## Immediate Next Actions

1. Add protected-call retry-on-401 handling in the PWA for cases where a request races token expiry before refresh completes.
2. Add delivery status badges and rollout summaries on dashboard and scene-management surfaces.
3. Replace the Phase 11 Matter placeholders with live commissioner, bridge, and device acknowledgement flows when rollout prerequisites are met.

## Decision Log

- 2026-07-01: Read and adopted `codex.md` as the governing technical brief for this workspace.
- 2026-07-01: Kept the user-requested top-level separation of `VPS/` and `PWA_APK/` instead of flattening everything into a single `apps/` folder at the root.
- 2026-07-01: Reserved `IOT_Device/` for firmware-side assets and references outside the immediate Phase 1 scope.
- 2026-07-01: Confirmed the hybrid workspace layout and approved `VPS/apps/admin-backend-ui` for the developer PID management panel.
- 2026-07-01: Used typed mock auth flows on the PWA side and typed Express auth routes on the API side to complete Phase 2 without introducing premature database coupling.
- 2026-07-01: Enforced developer-only PID backend access with explicit actor headers until the full RBAC/auth middleware is available.
- 2026-07-01: Kept the Phase 4 admin UI on the real PID route contract while allowing a local demo fallback only when the backend is unavailable.
- 2026-07-01: Wired the dashboard to the real device registry contract first, with frontend fallback only when the device API is unavailable.
- 2026-07-01: Implemented Phase 6 provisioning with backend-first intent and device registration contracts, while keeping BLE/AP service layers abstract and demo-capable until live transport integration is ready.
- 2026-07-01: Reused the proven FloodGuard BLE quick-search strategy by preferring the native Capacitor Bluetooth LE path with a two-pass discovery filter and preserving a demo fallback for non-native environments.
- 2026-07-01: Started Phase 7 from shared scene contracts and backend permission rules so the UI builder can target a stable automation model.
- 2026-07-02: Delivered the Phase 7 scene catalog and builder UI against the real scene API contract, with a local fallback store and manual-run evaluator to keep authoring usable without a live backend.
- 2026-07-02: Added explicit runtime scene evaluation endpoints and run-history support before introducing scheduler and telemetry worker infrastructure.
- 2026-07-02: Wired schedule scenes into an in-process scheduler and device-threshold scenes into a direct telemetry ingest path so Phase 7 now executes automatically within the running API process.
- 2026-07-02: Persisted scenes, scene audit logs, and scene run history in MongoDB behind a shared repository abstraction while preserving in-memory mode for tests.
- 2026-07-02: Added Mongo lease-based scheduler leadership so multi-instance deployments do not run the same schedule tick concurrently.
- 2026-07-02: Added HOME members, share codes, redeem flow, role-aware access, and HOME management UI on the real `/api/v1/homes` contract with local fallback support.
- 2026-07-02: Added device-facing PID metadata, device center pages, firmware request controls, dynamic PID page rendering, settings pages, and Phase 9 validation coverage.
- 2026-07-02: Added OTA release records, PID/hardware-aware firmware resolution, API package and key management, public device API scope enforcement, and Phase 10 validation coverage.
- 2026-07-02: Added Matter readiness contracts, PID matter-mode consistency validation, placeholder commissioning and bridge routes, restricted Matter scene commands, and device-detail Matter status panels for Phase 11.
- 2026-07-02: Locked Matter runtime behind an explicit activation flag so the MQTT/VPS-side modeling remains in place while live Matter actions stay disabled until vendor ID, CSA, and multi-product rollout readiness are complete.
- 2026-07-02: Added repository abstractions and MongoDB-backed drivers for PID records, PID audit logs, and device records so the core product/device layer now matches the scene durability baseline.
- 2026-07-03: Added MongoDB-backed HOME, provisioning, OTA, and API access drivers, and replaced header-trusted HOME role handling with server-authoritative membership resolution across device, scene, Matter, and API key flows.
- 2026-07-03: Added MongoDB-backed auth persistence, signed bearer-auth middleware, PWA bearer-auth migration, local session persistence, and a scene action worker queue for runtime isolation.
- 2026-07-03: Added queue-backed scene runtime evaluation workers for telemetry and schedules, plus automatic PWA refresh-token rotation before bearer access-token expiry.
- 2026-07-03: Added an MQTT runtime bridge for telemetry ingress, schedule ticks, scene command delivery, and OTA request delivery so MQTT can be the main VPS runtime bus while HTTP telemetry remains a fallback path.
- 2026-07-03: Added durable scene-command acknowledgement handling, OTA delivery job persistence, MQTT acknowledgement topics, and a dedicated OTA delivery worker so runtime delivery can retry safely beyond the request path.
- 2026-07-03: Added rollout history and replay APIs for OTA and scene dispatch jobs, and surfaced failed firmware delivery recovery in the PWA device detail flow first.
- 2026-07-07: Added scene-detail dispatch history, replay controls, and a local fallback ledger so scene delivery recovery is now operator-facing in the PWA without requiring API-only tooling.

## Risks and Controls

| Risk | Impact | Control |
| --- | --- | --- |
| Folder mapping confusion | Rework during Phase 1 | Confirm structure before scaffolding |
| PID rules ignored in early modules | Core architecture drift | Centralize PID types and validation in shared packages |
| Large files and mixed concerns | Low maintainability | Enforce small modules and feature-based folders |
| Missing tests in early setup | Regressions compound later | Treat tests as a phase exit requirement |
| Cross-app contract mismatch | Runtime failures | Share types and device schemas from root packages |

## Progress Update Template

Use this section for quick append-only execution notes after each meaningful implementation step.

- 2026-07-01: Initial plan created after reading `codex.md` and inspecting the current workspace.
- 2026-07-01: Phase 1 scaffolding started after folder mapping confirmation.
- 2026-07-01: Phase 1 validation completed successfully.
- 2026-07-01: Phase 2 auth and HOME base implementation completed successfully.
- 2026-07-01: Phase 3 PID backend implementation and validation completed successfully.
- 2026-07-01: Phase 4 PID admin UI implementation and validation completed successfully.
- 2026-07-01: Phase 5 device registry and dashboard implementation completed successfully.
- 2026-07-01: Phase 6 provisioning UI, abstract transport services, intent API bridge, and validation completed successfully.
- 2026-07-01: BLE quick-search integration completed successfully using the FloodGuard scanning pattern.
- 2026-07-01: Phase 7 scene pipeline backend foundation and validation completed successfully.
- 2026-07-02: Phase 7 scene catalog and builder UI completed with route integration, page tests, and full workspace validation.
- 2026-07-02: Phase 7 runtime orchestration hooks completed for schedule and device-threshold evaluation, history retrieval, and full workspace validation.
- 2026-07-02: Phase 7 automatic runtime wiring completed with scheduler bootstrap, telemetry ingest, scheduler tests, and full workspace validation.
- 2026-07-02: Phase 11 Matter readiness completed with backend placeholders, PID validation alignment, restricted-command coverage, device-detail Matter UI, and full workspace validation.
- 2026-07-02: Phase 12 core persistence baseline completed with PID/device MongoDB drivers, bootstrap wiring, and full workspace validation.
- 2026-07-03: Phase 13 extended persistence and RBAC hardening completed with HOME/provisioning/OTA/API access MongoDB drivers, server-authoritative HOME membership checks, and full workspace validation.
- 2026-07-03: Phase 14 auth middleware and runtime isolation completed with MongoDB-backed auth sessions, bearer-auth route migration, scene action dispatch worker isolation, and full workspace validation.
- 2026-07-03: Phase 15 queued runtime evaluation and session refresh completed with MongoDB-backed scene evaluation jobs, scheduler/telemetry queue routing, PWA token rotation, and full workspace validation.
- 2026-07-03: Phase 16 MQTT runtime ingress and delivery execution completed with MQTT bridge bootstrap, scheduler/telemetry publish boundaries, consumer handlers, scene action MQTT delivery, firmware OTA publish support, and full workspace validation.
- 2026-07-03: Phase 17 delivery acknowledgement and rollout persistence completed with scene-command ack tracking, retryable dispatch leases, OTA delivery jobs, a dedicated OTA worker, MQTT ack handlers, and full workspace validation.
- 2026-07-03: Phase 18 rollout status and replay controls completed with device rollout history routes, scene dispatch history routes, replay APIs for failed jobs, device-detail rollout UI, and full workspace validation.
- 2026-07-07: Phase 19 scene dispatch recovery UI completed with scene-detail dispatch history, failed-job replay controls, fallback dispatch persistence, and web-PWA lint, typecheck, test, and build validation.
