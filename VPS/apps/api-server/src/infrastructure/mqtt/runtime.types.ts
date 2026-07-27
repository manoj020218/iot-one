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
  /** Needed to build the canonical per-device topic (jnx/{tenantId}/{pid}/{deviceId}/telemetry). */
  pid: string;
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
  /** Needed to build the canonical per-device topic (jnx/{tenantId}/{pid}/{deviceId}/cmd). */
  pid: string;
  command: NonNullable<SceneAction["command"]>;
  payload?: Record<string, unknown>;
}

export interface RuntimeDeviceCommandAckMessage {
  deliveryId: string;
  deviceId: string;
  acknowledgedAt: string;
  status: "completed" | "failed";
  errorMessage?: string;
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

export interface RuntimeOtaAckMessage {
  requestId: string;
  deviceId: string;
  acknowledgedAt: string;
  status: "completed" | "failed";
  appliedVersion?: string;
  errorMessage?: string;
}

/**
 * Generic inbound envelope for the "events" and "status" canonical topic
 * suffixes — used by event-driven devices (e.g. the nurse call receiver) that
 * don't fit the numeric telemetry model. Address comes from the topic itself
 * (see parseDeviceTopic); the payload shape is device/PID-specific and
 * interpreted by whichever module owns that PID.
 */
export interface RuntimeDeviceTopicMessage {
  tenantId: string;
  pid: string;
  deviceId: string;
  payload: Record<string, unknown>;
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
