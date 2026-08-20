# Smart Streamer — UI/UX Implementation Plan

Status: planning document, not yet built. Grounded in a direct read of the
live `PWA_APK/apps/web-pwa` source (React + Vite + react-router-dom), not
assumptions. File paths below are real, existing files, cited so this plan
stays checkable against the repo as it evolves.

---

## 1. Architecture decision: how Smart Streamer mounts into the platform

The platform has **two different "plugin" patterns already in production**.
Smart Streamer needs to pick the right one — they are not interchangeable.

### Pattern A — `devicePackageRegistry` (Tank Guard's pattern)
`PWA_APK/apps/web-pwa/src/features/devices/plugins/devicePackageRegistry.ts`
dynamically `<script>`-loads a remote bundle at runtime, keyed by
`packageId+version`, and resolves **one exported React component**:

```ts
DevicePackageComponent = ComponentType<{
  device: DeviceRecord;
  pidProfile: DevicePidProfile;
  runtime: DeviceUiRuntimeState;   // { telemetrySnapshot, settings }
  onRefresh: () => Promise<void>;
  onCommand: (input: DeviceUiCommandRequest) => Promise<void>;
}>
```
See `tank-guard-mobile/v1.0.0/TankGuardDynamicPage.tsx`. This is a **single
card embedded inside the existing generic Device Detail page** — it renders
telemetry and issues commands for one device. It has no routes, no
navigation, no multi-page flow of its own.

### Pattern B — statically-registered feature module (Devices, Scenes, Settings)
`PWA_APK/apps/web-pwa/src/app/AppRouter.tsx` directly imports feature pages
and registers routes:
```tsx
<Route path="/devices" element={<DeviceManagementPage />} />
<Route path="/scenes" element={<SceneListPage />} />
<Route path="/settings" element={<SettingsHomePage />} />
```
Every existing multi-page area of the app (`features/devices`,
`features/scenes`, `features/settings`, `features/provisioning`) is built
this way: its own feature folder, its own pages, its own nav entry.

### Decision: **Smart Streamer is Pattern B**, not Pattern A

`Streamer Plugin.txt` §5 asks for nine top-level sections (Overview, Devices,
Cameras, Destinations, Schedules, Live Sessions, Diagnostics, OTA, Settings)
— that is a full product surface, structurally identical to what
`features/scenes` or `features/settings` already are, not a single embedded
telemetry card. Forcing it into `devicePackageRegistry` would mean either
one giant component (violates the 200-line rule immediately) or inventing a
multi-route capability that pattern was never built for.

**"Loaded on demand"** is satisfied the way the rest of the app already
achieves it: **route-based code splitting** (`React.lazy()` +
`import()`), not runtime remote-script loading. Users who don't own a Smart
Streamer device never download its JS chunk; users who do, fetch it the
first time they open the section. This matches Vite's default behavior and
requires no new platform capability — see `PLATFORM_ADDITIONS.md` (this
task's companion doc) for the one open question this raises for the
platform maintainer: whether the nav item itself should be conditionally
shown only to tenants that own a Smart Streamer device (needs a cheap
"does this home own PID family X" check).

---

## 2. Where Smart Streamer plugs into existing structures

| Concept | Existing platform equivalent | Smart Streamer usage |
|---|---|---|
| Tenant | `Home` (`homeId`, `x-home-id` header) — `VPS/apps/api-server/src/modules/homes/home.model.ts` | Every Smart Streamer resource (device, camera, destination, schedule) is scoped to `homeId`, exactly like existing home-scoped resources. |
| Device | `DeviceRecord { deviceId, pid, ... }` — `packages/shared/src/types/device.ts` | A Smart Streamer P4 is a `DeviceRecord` with `pid` in the `STREAMER` PID family (`VPS/apps/api-server/src/modules/pid/`). No new device table — reuse `devices`. |
| Auth | `Authorization: Bearer <accessToken>` + `x-home-id` — `app/apiHeaders.ts`, `app/authenticatedRequest.ts` | Every Smart Streamer API call uses the same `fetchAuthenticatedJson<T>()` helper, same 401-refresh-retry logic, same `{ data: T }` response envelope. Do not write a second HTTP client. |
| Provisioning | `features/provisioning/{ble,ap}` | Smart Streamer's "Add Device" flow **calls into** this existing flow (per PROVISIONING.md §5, the app side is already built) and only supplies PID-specific metadata after Wi-Fi connects. It does not reimplement BLE/SoftAP scanning UI. |
| OTA | `features/devices/components/DeviceFirmwarePanel.tsx`, `DeviceRolloutHistoryPanel.tsx` | Smart Streamer's OTA page/section reuses these components directly (channel/rollout model is already generic), adding only the "block OTA while a stream is live" guard clause the firmware/VPS prompts require. |
| Offline/API-down UX | `shouldUseDemoFallback()` in `authenticatedRequest.ts`, `homeDemoStore.ts` pattern | Smart Streamer pages should follow the same fallback-to-demo-data convention already used elsewhere, not invent a new offline pattern. |

---

## 3. Route map

Registered in `AppRouter.tsx` inside the existing `<RequireAuth>` /
`AuthenticatedAppFrame` wrapper, same as `/devices`, `/scenes`, `/settings`:

```
/streamer                          Overview dashboard
/streamer/devices                  Device list (Smart Streamer P4s only)
/streamer/devices/:deviceId        Device detail (per Streamer Plugin §7)
/streamer/cameras                  Camera profile list
/streamer/cameras/:cameraId        Camera profile edit + Test Camera
/streamer/destinations             Destination profile list (YT/FB/IG)
/streamer/destinations/:destId     Destination profile edit
/streamer/schedules                Schedule calendar/list (per device or all)
/streamer/schedules/:scheduleId    Schedule edit
/streamer/sessions/:sessionId      Live session page
/streamer/diagnostics/:deviceId    Diagnostics/health for one device
/streamer/settings                 Device Settings — notification prefs, camera defaults
```
Labeled **"Device Settings"** in the nav, not "Settings" — the platform
already owns `/settings` (account/home management, `SettingsHomePage`).
Two tabs both reading "Settings" in the same app would be a real point of
confusion, so the plugin's own tab is scoped and named accordingly.

All lazy-loaded:
```tsx
const StreamerOverviewPage = lazy(() => import("../features/streamer/StreamerOverviewPage"));
```

Bottom nav (`app/layout/AppBottomNav.tsx`): add a "Streamer" tab **only
rendered when the current home owns at least one Smart Streamer device** —
avoids cluttering navigation for every other Jenix One product's customers.
This conditional-nav lookup is the one small platform hook flagged above.

---

## 4. Page-by-page UX notes

Only calling out decisions that aren't obvious from Streamer Plugin.txt
directly, or that resolve an ambiguity in it against real platform
constraints:

- **Overview**: device summary cards per Streamer Plugin §6. Primary-action
  button text is driven off `StreamState` from the device-to-VPS contract
  (see `API_CONTRACT` in the firmware folder) — the UI must not invent
  states the device/VPS don't actually report.
- **Device Detail**: reuses the same page shell as the generic
  `DeviceDetailPage`, but slots in a Smart Streamer–specific content region
  (current stream, camera, destinations, schedules, actions) the way
  `TankGuardDynamicPage` slots into the generic device detail via
  `devicePackageRegistry` today for the *telemetry card only*. For Smart
  Streamer's much larger surface, this becomes a full nested route
  (`/streamer/devices/:deviceId`) rather than a props-injected component —
  consistent with the Pattern-B decision in §1.
- **Camera form**: password field never round-trips from the server after
  save (`••••••••` placeholder, per Streamer Plugin §8) — the API contract
  must omit `rtsp_password` entirely from GET responses, not send a masked
  string, so there's no accidental leak in a dev tools network tab.
  Same rule for destination stream keys (§9).
- **Start Stream flow**: must render the exact `DEVICE_ALREADY_STREAMING`
  conflict copy from Streamer Plugin §10 keyed off the VPS error `code`
  field, not off HTTP status alone — 409 alone doesn't distinguish
  "already streaming" from "destination locked by another device," and
  those need different messages and different recovery actions.
- **Live Session page**: never attempts to embed video (§11) — reinforce
  in code review, since it's the single easiest thing for a future
  contributor to accidentally "improve."
- **Bulk operations**: staggered start only, server-assigned windows (§14)
  — the UI shows an assigned window, it does not compute one client-side.

---

## 5. Proposed file layout

Following the existing `features/<name>/` convention and the 200-line
discipline this project (unlike the rest of the platform today) actually
intends to hold to:

```
PWA_APK/apps/web-pwa/src/features/streamer/
├── routes.ts                       # lazy() route table, imported once by AppRouter
├── constants/
│   ├── errorCodes.ts                # shared ErrorCode -> user-facing copy map
│   └── statusLabels.ts
├── schemas/
│   ├── device.schema.ts             # runtime validation (existing schema-validation lib)
│   ├── camera.schema.ts
│   ├── destination.schema.ts
│   ├── schedule.schema.ts
│   └── session.schema.ts
├── services/                        # ONE file per resource, thin wrappers over fetchAuthenticatedJson
│   ├── streamerDevicesApi.ts
│   ├── streamerCamerasApi.ts
│   ├── streamerDestinationsApi.ts
│   ├── streamerSchedulesApi.ts
│   ├── streamerSessionsApi.ts
│   └── streamerDiagnosticsApi.ts
├── hooks/
│   ├── useStreamerDevices.ts
│   ├── useStreamerSession.ts        # adaptive polling per §25 of Streamer Plugin.txt
│   └── useStreamerSchedules.ts
├── permissions/
│   └── streamerPermissions.ts       # smart_streamer.* checks, §17
├── pages/
│   ├── StreamerOverviewPage.tsx
│   ├── StreamerDeviceListPage.tsx
│   ├── StreamerDeviceDetailPage.tsx
│   ├── StreamerCameraListPage.tsx
│   ├── StreamerCameraFormPage.tsx
│   ├── StreamerDestinationListPage.tsx
│   ├── StreamerDestinationFormPage.tsx
│   ├── StreamerScheduleListPage.tsx
│   ├── StreamerScheduleFormPage.tsx
│   ├── StreamerLiveSessionPage.tsx
│   └── StreamerDiagnosticsPage.tsx
├── components/
│   ├── DeviceSummaryCard.tsx
│   ├── StreamStateChip.tsx          # text + icon, never color-only (§6)
│   ├── StartStreamDialog.tsx
│   ├── CameraTestSteps.tsx          # 6-step checklist, §8
│   ├── CredentialExpiryBanner.tsx
│   └── ScheduleConflictNotice.tsx
├── forms/
│   ├── CameraProfileForm.tsx
│   ├── YouTubeDestinationForm.tsx
│   ├── FacebookDestinationForm.tsx
│   ├── InstagramDestinationForm.tsx
│   └── ScheduleForm.tsx
└── tests/
    ├── streamerDevicesApi.spec.ts
    ├── startStreamFlow.spec.tsx
    ├── secretMasking.spec.tsx
    └── scheduleConflict.spec.tsx
```

Every file above is scoped to one responsibility specifically so it has a
realistic chance of staying under 200 lines — e.g. one destination form
per platform (YouTube/Facebook/Instagram) rather than one polymorphic form,
because their field sets genuinely differ (Streamer Plugin §9).

---

## 6. State management

No new global store. Follow the pattern already used by `features/devices`
and `features/scenes`:
- Server state: fetched via the `services/*Api.ts` files, cached in local
  component/hook state, invalidated after mutations (create/update/delete),
  no separate cache library introduced.
- Form state: local to each form component, cleared immediately on save or
  cancel (Streamer Plugin §18 — "automatically clear sensitive form state").
- Live-session polling: `useStreamerSession` hook implements the adaptive
  interval table from Streamer Plugin §25 (10–30s on the live page, reduced
  when backgrounded), with jitter, mirroring the reconnect-jitter discipline
  already required on the firmware side.

---

## 7. Phased build order

Matches Streamer Plugin.txt §30, translated into concrete deliverables:

1. **Route + nav skeleton** — `routes.ts`, empty page shells, bottom-nav
   entry gated on device ownership. Verifiable in-browser immediately.
2. **Device list/detail** — read-only, wired to real `devices` API filtered
   by PID family, no mutations yet.
3. **Provisioning hook-in** — "Add Smart Streamer" launches the existing
   BLE/AP flow with PID metadata pre-filled; no new provisioning UI code.
4. **Camera profiles** — CRUD + Test Camera flow.
5. **Destination profiles** — CRUD for all three platforms, secret masking.
6. **Manual stream control** — start/stop, conflict handling, live session
   page.
7. **Schedules** — calendar/list views, conflict detection.
8. **Diagnostics + notifications** — health screen, notification prefs
   (blocked on the notifications module gap — see `PLATFORM_ADDITIONS.md`).
9. **OTA integration** — reuse `DeviceFirmwarePanel`, add live-stream guard.
10. **Tests + docs.**

Each phase should be reviewable and mergeable independently — do not build
all ten phases in one uninterrupted pass.

---

## 8. Open dependency

This plan assumes the API contract in
`VPS/API_CONTRACT.md` (companion document) as the source of truth for every
request/response shape referenced above. If that contract changes, treat
this plan's page-by-page notes as needing a re-check, not as independently
authoritative.
