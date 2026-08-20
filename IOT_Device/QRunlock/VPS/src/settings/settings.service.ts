import { QRUNLOCK_PID } from "../constants";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { settingsRepository } from "./settings.model";
import type { QrunlockDeviceSettings, UpdateSettingsInput } from "./settings.types";
import { QrunlockSettingsError } from "./settings.types";

async function requireQrunlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<void> {
  const device = await deps.getDevice(deviceId, context);
  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockSettingsError(404, "DEVICE_NOT_FOUND", `Not a QRunlock device: ${deviceId}`);
  }
}

export async function getSettings(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<QrunlockDeviceSettings> {
  await requireQrunlockDevice(deps, deviceId, context);
  return settingsRepository.get(deviceId);
}

export async function updateSettings(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext,
  input: UpdateSettingsInput
): Promise<QrunlockDeviceSettings> {
  await requireQrunlockDevice(deps, deviceId, context);
  const settings = await settingsRepository.save(deviceId, input);

  // Trigger only — QRunlock firmware does not yet subscribe to a settings
  // sync command (see IOT_Device/QRunlock/PROVISIONING.md §9, item 9: MQTT
  // wiring is still pending), and relayStateAfterPowerRestore/switchType
  // have no firmware config fields at all yet (settings.types.ts).
  // Persisting server-side now so the API contract is stable; the
  // dispatch below is a no-op from the device's perspective until that
  // firmware work lands, same "trigger only, ack path not built yet"
  // honesty as Smart Streamer's session start (see
  // IOT_Device/Smart Streamer/VPS/src/sessions/session.service.ts).
  await deps.dispatchDeviceUiCommand(
    deviceId,
    {
      command: "sync_settings",
      payload: {
        relayCooldownMs: settings.relayCooldownMs,
        relayStateAfterPowerRestore: settings.relayStateAfterPowerRestore,
        switchType: settings.switchType
      },
      requiresAck: false
    },
    context
  );

  return settings;
}
