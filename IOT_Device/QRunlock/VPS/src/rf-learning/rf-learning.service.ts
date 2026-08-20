import { activityRepository } from "../activity/activity.model";
import { QRUNLOCK_PID, QRUNLOCK_RF_LEARN_WINDOW_MS } from "../constants";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { rfLearningRepository } from "./rf-learning.model";
import type { RfLearnStateRecord } from "./rf-learning.types";
import { QrunlockRfLearnError } from "./rf-learning.types";

async function requireQrunlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<void> {
  const device = await deps.getDevice(deviceId, context);
  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockRfLearnError(404, "DEVICE_NOT_FOUND", `Not a QRunlock device: ${deviceId}`);
  }
}

/**
 * The platform never learns of a real RF-learn success/timeout from the
 * device today — QRunlock has no MQTT ack path yet (PROVISIONING.md §9).
 * "learning" -> "timeout" here is a server-side, best-effort derivation
 * based on config::kRfLearnWindowMs (mirrored in QRUNLOCK_RF_LEARN_WINDOW_MS)
 * so a stuck "learning" state doesn't block future attempts forever. It is
 * not authoritative — the firmware's own window is. Once firmware
 * publishes an rf-learn ack/result over MQTT, replace this with real
 * status instead of a derived guess.
 */
async function currentState(deviceId: string): Promise<RfLearnStateRecord> {
  const state = await rfLearningRepository.getState(deviceId);
  if (!state) {
    return { deviceId, status: "idle", startedAt: null, updatedAt: new Date(0).toISOString() };
  }

  if (state.status === "learning" && state.startedAt) {
    const elapsedMs = Date.now() - new Date(state.startedAt).getTime();
    if (elapsedMs > QRUNLOCK_RF_LEARN_WINDOW_MS) {
      const timedOut: RfLearnStateRecord = {
        ...state,
        status: "timeout",
        updatedAt: new Date().toISOString()
      };
      await activityRepository.record(deviceId, "rf_learn_timeout", "system");
      return rfLearningRepository.save(timedOut);
    }
  }

  return state;
}

export async function getRfLearnState(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<RfLearnStateRecord> {
  await requireQrunlockDevice(deps, deviceId, context);
  return currentState(deviceId);
}

export async function startRfLearning(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<RfLearnStateRecord> {
  await requireQrunlockDevice(deps, deviceId, context);

  const state = await currentState(deviceId);
  if (state.status === "learning") {
    throw new QrunlockRfLearnError(409, "RF_LEARN_ALREADY_ACTIVE", `RF-learn already active for ${deviceId}`);
  }

  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "rf_learn_start", requiresAck: true },
    context
  );

  const now = new Date().toISOString();
  await activityRepository.record(deviceId, "rf_learn_start", "app");
  return rfLearningRepository.save({ deviceId, status: "learning", startedAt: now, updatedAt: now });
}

export async function cancelRfLearning(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<RfLearnStateRecord> {
  await requireQrunlockDevice(deps, deviceId, context);

  const state = await currentState(deviceId);
  if (state.status !== "learning") {
    throw new QrunlockRfLearnError(409, "RF_LEARN_NOT_ACTIVE", `No active RF-learn session for ${deviceId}`);
  }

  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "rf_learn_cancel", requiresAck: true },
    context
  );

  await activityRepository.record(deviceId, "rf_learn_cancel", "app");
  return rfLearningRepository.save({
    ...state,
    status: "cancelled",
    updatedAt: new Date().toISOString()
  });
}
