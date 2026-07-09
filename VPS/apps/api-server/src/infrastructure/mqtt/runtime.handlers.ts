import { applyDeviceTelemetryState } from "../../modules/devices/device.service";
import { deviceUiRuntimeStore } from "../../modules/devices/device-ui-runtime.model";
import { acknowledgeOtaDeliveryFailure, acknowledgeOtaDeliverySuccess } from "../../modules/ota/ota.service";
import {
  enqueuePreparedSceneEvaluationJobs
} from "../../modules/scenes/scene.service";
import { sceneActionDispatchRepository } from "../../modules/scenes/scene.model";
import type { SceneRuntimeQueueResponse } from "../../modules/scenes/scene.types";
import type {
  RuntimeDeviceCommandAckMessage,
  RuntimeOtaAckMessage,
  RuntimeScheduleTickMessage,
  RuntimeTelemetryIngressMessage
} from "./runtime.types";

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
