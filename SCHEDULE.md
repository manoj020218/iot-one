# Platform Schedule / Automation — Integration Guide

Audience: whoever is bringing up a new IoT product (firmware) or its
backend module on Jenix One, and wants that device's ON/OFF (or any other)
actions to work with the platform's schedule and automation system —
the same "Tap-to-Run" and "Automation" scenes used by every other device,
the way Tuya/SmartLife let any product plug into one shared automation
engine instead of each product inventing its own.

**The short version: the schedule engine itself is already 100% generic
and device-agnostic. You never write a new scheduler.** The only thing
each device type needs to do is *declare which commands it accepts*, once,
in its PID blueprint. Everything else — the day/time picker, the IF/THEN
condition editor, the dispatch queue, retries — is shared platform code
you get for free.

---

## 1. How the pieces fit together

```
Scene (schedule OR device-threshold OR manual trigger)
  → conditions (optional, e.g. "tankLevelPct >= 80")
  → actions
      → "notification"      → shows up in the in-app Notification Center
      → "device_command"    → { deviceId, command, payload? }
                                 ↓
                    scene.action-worker.ts (generic, platform-owned)
                                 ↓
                    MQTT publish: jenix/{tenant}/{site}/{device}/command
                                 ↓
                         your firmware, listening on that topic
```

A `SceneSchedule` is just `{ timezone, daysOfWeek, time }` — it has no
concept of device type. It fires the scene; the scene's `actions` decide
what happens. So "make my device work with the platform schedule" really
means "make my device work as a `device_command` action target," which
breaks down into exactly two things:

1. Firmware understands the command over MQTT (§2).
2. Your PID declares that command so the app's automation builder can
   offer it and the backend can validate it (§3).

There is no per-device schedule code to write anywhere.

---

## 2. What's asked of the firmware developer

### 2.1 Pick your command names, keep them stable

Define your device's accepted commands once, firmware-side, the same way
Tank Guard does it in
`IOT_Device/Tank Guard/Firmware/Sensor/A02W/SW/src/shared/tankGuard.commands.ts`:

```ts
export type TankGuardCommandName =
  | "refresh"
  | "zero_calibrate"
  | "apply_settings"
  | "motor_on"
  | "motor_off"
  | "alarm_test";
```

These names are the contract between firmware and the platform. Pick
verbs, not implementation details (`motor_on`, not `gpio14_high`).

### 2.2 Check whether your command already exists platform-wide

Before inventing a new name, check the shared `SceneActionCommand` union
in `packages/shared/src/types/scene.ts`. If an existing command already
means what you need (e.g. `restart`, `refresh`, `sync`), reuse it —
one name, one meaning, across every device type, is what lets a user
reason about automations consistently the way they can in SmartLife.

If you genuinely need a new command (e.g. Smart Streamer's `start_stream`
/ `stop_stream`), it has to be added to that union first — see §3.1. This
is the *only* platform-repo change that requires a pull request from
outside your own device module; everything else in §3 lives in your PID
registration.

### 2.3 Listen on the standard command topic, handle the message generically

Your device already gets `{deviceId, pid, command, payload?}` published to
its MQTT command topic (`jenix/{tenant}/{site}/{device}/command`) —
this is the exact same message whether the action was triggered by a
manual "Tap-to-Run" scene, a schedule, or a device-threshold automation.
**Firmware does not need to know or care which one fired it.** Don't build
separate handling paths for "scheduled" vs "manual" — there's only one
message shape and one topic.

If a command carries a payload (e.g. Tank Guard's `apply_settings`),
document the exact JSON shape you expect, versioned:

```ts
{ command: "apply_settings", payload: { schemaVersion: 1, settings: {...} } }
```

### 2.4 Scheduling itself needs nothing from you

The platform's scheduler (`scene.scheduler.ts` / `scene.runtime-worker.ts`)
evaluates every active scene's `daysOfWeek`/`time` centrally and enqueues
the dispatch job. Your device does not poll for "is it time yet," does not
need an RTC synced to the schedule, and does not need to implement any
cron-like logic. It only needs to be online and subscribed when the
platform decides to fire — same as any manually-triggered command.

### 2.5 Known limitation, be aware of it

Today, `scene.action-worker.ts` marks a `device_command` action
"dispatched" the moment it publishes to MQTT — it does **not** wait for
or track a firmware acknowledgment (the one exception is `ota_force`,
which has its own delivery-tracking system). If your product needs the
app to reliably show "the pump actually turned on," that confirmation has
to come through your device's normal telemetry/state reporting, not
through scene dispatch status — there is currently no generic
command-ack channel wired into scenes. Flag this to the platform
maintainer if your product needs one; it's a real gap, not a
you-configured-it-wrong situation.

---

## 3. What's asked of the device-specific backend (api-server module)

For an ordinary command (turn something on/off, refresh, restart,
anything that's "tell the device to do X and move on"), **you do not
write any dispatch code.** `scene.action-worker.ts`'s generic path already
publishes `{deviceId, pid, command, payload}` for every command that
isn't specially handled. You only write custom backend logic if the
command needs server-side orchestration beyond "notify the device" — the
one existing example is `ota_force`, which queues a real OTA delivery job
(`queueOtaDeliveryForDevice`) instead of just publishing a message.

What you *do* need to do, once per product, is register your PID with an
`automation` profile:

### 3.1 If your command is new, add it to the shared union first

`packages/shared/src/types/scene.ts`:
```ts
export type SceneActionCommand =
  | "refresh"
  | ... 
  | "start_stream"   // <- add yours here
  | "stop_stream";
```
Then add its runtime entry + human label to
`packages/shared/src/utils/scene.ts` (`allSceneActionCommands` and
`describeSceneActionCommand`) — this is the single canonical list both
the frontend picker's fallback and the backend request validator read
from, so a command that's missing here silently can't be used by *any*
device, not just yours.

### 3.2 Declare your PID's `automation.commands`

In your PID blueprint (either a `CreatePidInput` constant in
`packages/device-schemas/src/pid/pid.types.ts`, or a payload posted to
`POST /api/v1/admin/pids`), add the `automation` group alongside the
existing `hardware`/`firmware`/`ui`/`dashboard` groups:

```ts
automation: {
  commands: [
    { command: "start_stream", label: "Start stream" },
    { command: "stop_stream", label: "Stop stream" }
  ]
}
```

`restricted?: boolean` on a command entry mirrors the platform's existing
role-gate for dangerous commands (`factory_reset`, `ota_force`,
`matter_commission`, `matter_bridge_sync` are restricted to
owner/admin today) — set it if your command is similarly destructive or
safety-critical, but note the restriction itself still has to be added
to `isRestrictedSceneCommand` in `packages/shared/src/utils/scene.ts` for
it to actually be enforced.

### 3.3 That's the whole integration

Once declared:

- The Scene builder's "Device command" picker automatically shows *only*
  your device's declared commands when a user selects one of your
  devices — no frontend code change needed per product.
- The backend automatically rejects (HTTP 422) any scene action that
  tries to send your device a command it didn't declare, even if that
  command is valid for some *other* device type.
- If you skip this step, nothing breaks — a device whose PID declares no
  `automation` profile falls back to the full platform command list
  (today's behavior for every device). Declaring it is strongly
  recommended (your users otherwise see every other product's commands
  in the picker), but it is not a migration gate.

---

## 4. Worked example — Smart Streamer

1. Firmware declares `start_stream`/`stop_stream` as its two commands,
   listens on its MQTT command topic, and does not implement any
   schedule logic itself.
2. `packages/shared/src/types/scene.ts` — `start_stream`/`stop_stream`
   added to `SceneActionCommand` (done).
3. `packages/shared/src/utils/scene.ts` — both added to
   `allSceneActionCommands` with labels (done).
4. `packages/device-schemas/src/pid/pid.types.ts` —
   `smartStreamerPidBlueprint.automation.commands` declares both (done).
5. Result: a user building an automation, picks a Smart Streamer device,
   sees exactly "Start stream" / "Stop stream" in the command dropdown —
   nothing else — and can schedule it for e.g. every day at 18:00,
   using the identical schedule UI Tank Guard or any other device uses.

## 5. Checklist for a new product

- [ ] Command names chosen, checked against the existing
      `SceneActionCommand` union for reuse first
- [ ] New commands (if any) added to `SceneActionCommand`
      (`packages/shared/src/types/scene.ts`) and to
      `allSceneActionCommands`/`describeSceneActionCommand`
      (`packages/shared/src/utils/scene.ts`)
- [ ] Firmware subscribes to its MQTT command topic and handles
      `{deviceId, pid, command, payload?}` generically — no
      manual-vs-scheduled branching
- [ ] Payload shape documented (versioned) for any command that takes one
- [ ] PID blueprint declares `automation.commands` with a label per
      command, and `restricted: true` on anything destructive
- [ ] (Only if the command needs server-side side effects beyond
      notifying the device) custom dispatch logic added to
      `scene.action-worker.ts`'s `dispatchSceneAction`, following the
      `ota_force` special case as the template
