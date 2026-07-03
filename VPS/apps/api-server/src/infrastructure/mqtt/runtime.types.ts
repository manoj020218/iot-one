import type {
  DeviceConnectivityStatus,
  DeviceLocalStatus,
  OtaReleaseChannel,
  SceneAction,
  SceneTelemetrySnapshot
} from "@jenix/shared";

import type { SceneEvaluationJob, SceneRuntimeSource } from "../../modules/scenes/scene.types";

export interface RuntimeTelemetryIngressMessage {
  job: SceneEvaluationJob;
  mqttStatus?: DeviceConnectivityStatus;
  cloudStatus?: DeviceConnectivityStatus;
  localStatus?: DeviceLocalStatus;
}

export interface RuntimeScheduleTickMessage {
  job: SceneEvaluationJob;
}

export interface RuntimeDeviceCommandMessage {
  deliveryId: string;
  runId: string;
  sceneId: string;
  homeId: string;
  source: SceneRuntimeSource;
  requestedAt: string;
  deviceId: string;
  command: NonNullable<SceneAction["command"]>;
  payload?: Record<string, unknown>;
}

export interface RuntimeNotificationMessage {
  deliveryId: string;
  runId: string;
  sceneId: string;
  homeId: string;
  source: SceneRuntimeSource;
  requestedAt: string;
  message: string;
  payload?: Record<string, unknown>;
}

export interface RuntimeOtaRequestMessage {
  requestId: string;
  deviceId: string;
  homeId: string;
  pid: string;
  channel: OtaReleaseChannel;
  targetVersion: string;
  artifactUrl: string;
  checksum: string;
  requestedAt: string;
  requestedBy: string;
  currentVersion?: string;
}

export interface RuntimeMqttBridge {
  publishTelemetryIngress(message: RuntimeTelemetryIngressMessage): Promise<void>;
  publishScheduleTick(message: RuntimeScheduleTickMessage): Promise<void>;
  publishDeviceCommand(message: RuntimeDeviceCommandMessage): Promise<void>;
  publishNotification(message: RuntimeNotificationMessage): Promise<void>;
  publishOtaRequest(message: RuntimeOtaRequestMessage): Promise<void>;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}

export interface RuntimeTelemetryIngressInput {
  homeId: string;
  deviceId: string;
  telemetry: SceneTelemetrySnapshot;
  occurredAt: string;
  mqttStatus?: DeviceConnectivityStatus;
  cloudStatus?: DeviceConnectivityStatus;
  localStatus?: DeviceLocalStatus;
}
