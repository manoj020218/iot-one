# Jenix IoT Platform Project Plan

## Project Snapshot

- Initialized: 2026-07-01
- Source brief: `D:\IOT Device\IOT_Platform\codex.md`
- Workspace root: `D:\IOT Device\IOT_Platform\jenix One`
- Current status: Phase 7 scene UI and runtime orchestration complete
- Current status: Phase 7 durable MongoDB-backed scene persistence complete
- Current status: Phase 7 distributed scheduler coordination complete
- Current status: Phase 8 home management and sharing complete
- Current phase: Phase 8 - home management and sharing

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

Status: Pending

Deliverables:
- [ ] Device management page
- [ ] Device detail page
- [ ] Firmware update panel
- [ ] Dynamic PID page renderer
- [ ] User profile page
- [ ] App update page

Validation gates:
- [ ] Missing PID page fallback tests
- [ ] Firmware action permission tests

### Phase 10 - OTA and Third-Party API

Status: Pending

Deliverables:
- [ ] OTA release model
- [ ] OTA compatibility resolution by PID
- [ ] API package model
- [ ] Third-party API key management
- [ ] Public API scope enforcement

Validation gates:
- [ ] Correct PID OTA selection tests
- [ ] API scope enforcement tests
- [ ] Wrong PID denial tests

### Phase 11 - Matter Readiness

Status: Pending

Deliverables:
- [ ] Matter mapping model
- [ ] Matter mode in PID model
- [ ] Matter status on device detail page
- [ ] Matter bridge placeholder
- [ ] Matter commissioning placeholder

Validation gates:
- [ ] Matter mode validation tests
- [ ] Restricted Matter command tests

## Current Open Questions

- None at the planning level. Implementation issues will be logged here only if they block the phase.

## Immediate Next Actions

1. Start Phase 9 settings pages and dynamic PID-driven device pages on top of the new HOME role model.
2. Move scheduled and high-volume runtime execution into MQTT, queue, or worker-backed infrastructure if deployment load requires stronger process isolation.
3. Persist PID, device registry, provisioning intent, and HOME sharing modules in MongoDB for platform-wide durability.
4. Keep `PROGRESS.md` updated after each remaining milestone.

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
