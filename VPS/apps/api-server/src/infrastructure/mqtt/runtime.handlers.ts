import { applyDeviceTelemetryState } from "../../modules/devices/device.service";
import { deviceUiRuntimeStore } from "../../modules/devices/device-ui-runtime.model";
import { acknowledgeOtaDeliveryFailure, acknowledgeOtaDeliverySuccess } from "../../modules/ota/ota.service";
import {
  enqueuePreparedSceneEvaluationJobs
} from "../../modules/scenes/scene.service";
import { sceneActionDispatchRepository } from "../../modules/scenes/scene.model";
import type { SceneRuntimeQueueResponse } from "../../modules/scenes/scene.types";
import { raiseCall } from "../../modules/nurse-call-receiver/nurse-call-receiver.service";
import type {
  RuntimeDeviceCommandAckMessage,
  RuntimeDeviceTopicMessage,
  RuntimeOtaAckMessage,
  RuntimeScheduleTickMessage,
  RuntimeTelemetryIngressMessage
} from "./runtime.types";

/** PIDs that speak the event-driven ("events"/"status" topic) model rather than
 *  flat numeric telemetry. Each entry below fans out to that device module's own
 *  ingestion function — add a case per PID as more event-driven devices onboard. */
const nurseCallReceiverPid = "JNX-RFNC-C3-01";

function readStringField(
  payload: Record<string, unknown>,
  key: string
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readTelemetryValue(
  payload: Record<string, unknown>,
  key: string
): boolean | number | string | undefined {
  const value = payload[key];
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string"
    ? value
    : undefined;
}

export async function handleRuntimeTelemetryIngressMessage(
  message: RuntimeTelemetryIngressMessage
): Promise<SceneRuntimeQueueResponse> {
  await applyDeviceTelemetryState(message.job.deviceId ?? "", {
    telemetry: message.job.telemetry ?? {},
    occurredAt: message.job.occurredAt,
    ...(message.mqttStatus ? { mqttStatus: message.mqttStatus } : {}),
    ...(message.cloudStatus ? { cloudStatus: message.cloudStatus } : {}),
    ...(message.localStatus ? { localStatus: message.localStatus } : {})
  });

  return enqueuePreparedSceneEvaluationJobs([message.job]);
}

export async function handleRuntimeScheduleTickMessage(
  message: RuntimeScheduleTickMessage
): Promise<SceneRuntimeQueueResponse> {
  return enqueuePreparedSceneEvaluationJobs([message.job]);
}

export async function handleRuntimeDeviceCommandAckMessage(
  message: RuntimeDeviceCommandAckMessage
): Promise<void> {
  await deviceUiRuntimeStore.saveLastCommand(message.deviceId, {
    commandId: message.deliveryId,
    deviceId: message.deviceId,
    status: message.status,
    queuedAt: message.acknowledgedAt,
    acknowledgedAt: message.acknowledgedAt,
    ...(message.errorMessage ? { errorMessage: message.errorMessage } : {}),
    ...(message.payload ? { payload: message.payload } : {})
  });

  if (message.status === "completed") {
    await sceneActionDispatchRepository.complete(
      message.deliveryId,
      message.acknowledgedAt,
      message.acknowledgedAt
    );
    return;
  }

  await sceneActionDispatchRepository.fail(
    message.deliveryId,
    message.acknowledgedAt,
    message.errorMessage ?? "Device command delivery failed"
  );
}

export async function handleRuntimeOtaAckMessage(
  message: RuntimeOtaAckMessage
): Promise<void> {
  if (message.status === "completed") {
    await acknowledgeOtaDeliverySuccess(
      message.requestId,
      message.acknowledgedAt,
      message.appliedVersion
    );
    return;
  }

  await acknowledgeOtaDeliveryFailure(
    message.requestId,
    message.acknowledgedAt,
    message.errorMessage ?? "OTA delivery failed"
  );
}

export async function handleRuntimeDeviceEventsMessage(
  message: RuntimeDeviceTopicMessage
): Promise<void> {
  if (message.pid !== nurseCallReceiverPid) {
    return;
  }

  const eventType = readStringField(message.payload, "eventType");

  if (eventType !== "call_raised" && eventType !== "call_repeated") {
    return;
  }

  const remoteId = readStringField(message.payload, "remoteSlot");
  const remoteName = readStringField(message.payload, "remoteName");
  const bedLabel = readStringField(message.payload, "bedId");

  await raiseCall(message.deviceId, {
    occurredAt: new Date().toISOString(),
    ...(remoteId ? { remoteId } : {}),
    ...(remoteName ? { remoteName } : {}),
    ...(bedLabel ? { bedLabel } : {})
  });
}

export async function handleRuntimeDeviceStatusMessage(
  message: RuntimeDeviceTopicMessage
): Promise<void> {
  if (message.pid !== nurseCallReceiverPid) {
    return;
  }

  const telemetry: Record<string, boolean | number | string> = {};

  for (const key of [
    "pairedRemotes",
    "activeCalls",
    "mode",
    "wifiConnected",
    "mqttConnected",
    "espNowStatus"
  ]) {
    const value = readTelemetryValue(message.payload, key);

    if (value !== undefined) {
      telemetry[key] = value;
    }
  }

  await deviceUiRuntimeStore.saveTelemetry({
    deviceId: message.deviceId,
    pid: message.pid,
    occurredAt: new Date().toISOString(),
    telemetry
  });
}
