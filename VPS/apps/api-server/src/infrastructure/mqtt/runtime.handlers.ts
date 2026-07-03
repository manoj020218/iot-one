import { applyDeviceTelemetryState } from "../../modules/devices/device.service";
import {
  enqueuePreparedSceneEvaluationJobs
} from "../../modules/scenes/scene.service";
import type { SceneRuntimeQueueResponse } from "../../modules/scenes/scene.types";
import type {
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
