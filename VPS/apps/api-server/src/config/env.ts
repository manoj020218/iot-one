export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri?: string;
  mqttRuntimeEnabled: boolean;
  mqttUrl?: string;
  mqttUsername?: string;
  mqttPassword?: string;
  mqttClientId: string;
  /** Internal-only (scheduler tick fan-out across instances) — not device-facing. */
  mqttScheduleTopic: string;
  /** Internal-only (user notifications) — not device-facing. */
  mqttNotificationTopic: string;
  authPersistenceMode: "memory" | "mongodb";
  googleClientId?: string;
  matterRuntimeEnabled: boolean;
  pidPersistenceMode: "memory" | "mongodb";
  uiPackagePersistenceMode: "memory" | "mongodb";
  nurseCallReceiverPersistenceMode: "memory" | "mongodb";
  smartRfTransmitterPersistenceMode: "memory" | "mongodb";
  tokenDispenserPersistenceMode: "memory" | "mongodb";
  p10DisplayPersistenceMode: "memory" | "mongodb";
  sosSirenPersistenceMode: "memory" | "mongodb";
  devicePersistenceMode: "memory" | "mongodb";
  homePersistenceMode: "memory" | "mongodb";
  provisioningPersistenceMode: "memory" | "mongodb";
  otaPersistenceMode: "memory" | "mongodb";
  apiAccessPersistenceMode: "memory" | "mongodb";
  scenePersistenceMode: "memory" | "mongodb";
  notificationPersistenceMode: "memory" | "mongodb";
  sceneSchedulerEnabled: boolean;
  sceneSchedulerCoordinationMode: "local" | "mongodb-lock";
  sceneSchedulerInstanceId?: string;
  sceneSchedulerIntervalMs: number;
  sceneSchedulerLeaseMs: number;
  sceneActionWorkerEnabled: boolean;
  sceneActionWorkerIntervalMs: number;
  sceneActionWorkerBatchSize: number;
  sceneActionWorkerVisibilityTimeoutMs: number;
  otaDeliveryWorkerEnabled: boolean;
  otaDeliveryWorkerIntervalMs: number;
  otaDeliveryWorkerBatchSize: number;
  otaDeliveryWorkerVisibilityTimeoutMs: number;
  sceneRuntimeWorkerEnabled: boolean;
  sceneRuntimeWorkerIntervalMs: number;
  sceneRuntimeWorkerBatchSize: number;
  sceneRuntimeWorkerVisibilityTimeoutMs: number;
  deviceOfflineSweepIntervalMs: number;
  deviceOfflineStaleAfterMs: number;
}

function parseBooleanEnv(
  rawValue: string | undefined,
  defaultValue: boolean
): boolean {
  if (rawValue === undefined) {
    return defaultValue;
  }

  if (rawValue === "true") {
    return true;
  }

  if (rawValue === "false") {
    return false;
  }

  throw new Error(`Invalid boolean environment value: ${rawValue}`);
}

function parsePositiveIntegerEnv(
  rawValue: string | undefined,
  defaultValue: number,
  key: string
): number {
  if (rawValue === undefined) {
    return defaultValue;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${key} value: ${rawValue}`);
  }

  return parsed;
}

function parsePersistenceMode(
  rawValue: string | undefined,
  hasMongoUri: boolean,
  key: string
): "memory" | "mongodb" {
  if (rawValue === undefined) {
    return hasMongoUri ? "mongodb" : "memory";
  }

  if (rawValue === "memory" || rawValue === "mongodb") {
    return rawValue;
  }

  throw new Error(`Invalid ${key} value: ${rawValue}`);
}

function parseSceneSchedulerCoordinationMode(
  rawValue: string | undefined,
  scenePersistenceMode: "memory" | "mongodb"
): "local" | "mongodb-lock" {
  if (rawValue === undefined) {
    return scenePersistenceMode === "mongodb" ? "mongodb-lock" : "local";
  }

  if (rawValue === "local" || rawValue === "mongodb-lock") {
    return rawValue;
  }

  throw new Error(
    `Invalid SCENE_SCHEDULER_COORDINATION_MODE value: ${rawValue}`
  );
}

export function readAppConfig(): AppConfig {
  const rawPort = process.env.PORT ?? "4000";
  const port = Number(rawPort);
  const mongodbUri = process.env.MONGODB_URI?.trim() || undefined;
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim() || undefined;
  const mqttUrl = process.env.MQTT_URL?.trim() || undefined;
  const mqttUsername = process.env.MQTT_USERNAME?.trim() || undefined;
  const mqttPassword = process.env.MQTT_PASSWORD?.trim() || undefined;
  const mqttClientId =
    process.env.MQTT_CLIENT_ID?.trim() ||
    `jenix-api-${process.pid.toString()}`;
  const mqttScheduleTopic =
    process.env.MQTT_SCHEDULE_TOPIC?.trim() || "jenix/runtime/schedule";
  const mqttNotificationTopic =
    process.env.MQTT_NOTIFICATION_TOPIC?.trim() || "jenix/runtime/notifications";
  const sceneSchedulerIntervalMs = parsePositiveIntegerEnv(
    process.env.SCENE_SCHEDULER_INTERVAL_MS,
    30_000,
    "SCENE_SCHEDULER_INTERVAL_MS"
  );
  const authPersistenceMode = parsePersistenceMode(
    process.env.AUTH_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "AUTH_PERSISTENCE_MODE"
  );
  const homePersistenceMode = parsePersistenceMode(
    process.env.HOME_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "HOME_PERSISTENCE_MODE"
  );
  const pidPersistenceMode = parsePersistenceMode(
    process.env.PID_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "PID_PERSISTENCE_MODE"
  );
  const uiPackagePersistenceMode = parsePersistenceMode(
    process.env.UI_PACKAGE_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "UI_PACKAGE_PERSISTENCE_MODE"
  );
  const nurseCallReceiverPersistenceMode = parsePersistenceMode(
    process.env.NURSE_CALL_RECEIVER_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "NURSE_CALL_RECEIVER_PERSISTENCE_MODE"
  );
  const smartRfTransmitterPersistenceMode = parsePersistenceMode(
    process.env.SMART_RF_TRANSMITTER_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "SMART_RF_TRANSMITTER_PERSISTENCE_MODE"
  );
  const tokenDispenserPersistenceMode = parsePersistenceMode(
    process.env.TOKEN_DISPENSER_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "TOKEN_DISPENSER_PERSISTENCE_MODE"
  );
  const p10DisplayPersistenceMode = parsePersistenceMode(
    process.env.P10_DISPLAY_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "P10_DISPLAY_PERSISTENCE_MODE"
  );
  const sosSirenPersistenceMode = parsePersistenceMode(
    process.env.SOS_SIREN_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "SOS_SIREN_PERSISTENCE_MODE"
  );
  const devicePersistenceMode = parsePersistenceMode(
    process.env.DEVICE_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "DEVICE_PERSISTENCE_MODE"
  );
  const provisioningPersistenceMode = parsePersistenceMode(
    process.env.PROVISIONING_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "PROVISIONING_PERSISTENCE_MODE"
  );
  const otaPersistenceMode = parsePersistenceMode(
    process.env.OTA_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "OTA_PERSISTENCE_MODE"
  );
  const apiAccessPersistenceMode = parsePersistenceMode(
    process.env.API_ACCESS_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "API_ACCESS_PERSISTENCE_MODE"
  );
  const scenePersistenceMode = parsePersistenceMode(
    process.env.SCENE_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "SCENE_PERSISTENCE_MODE"
  );
  const notificationPersistenceMode = parsePersistenceMode(
    process.env.NOTIFICATION_PERSISTENCE_MODE,
    Boolean(mongodbUri),
    "NOTIFICATION_PERSISTENCE_MODE"
  );
  const sceneSchedulerCoordinationMode = parseSceneSchedulerCoordinationMode(
    process.env.SCENE_SCHEDULER_COORDINATION_MODE,
    scenePersistenceMode
  );
  const sceneSchedulerLeaseMs = parsePositiveIntegerEnv(
    process.env.SCENE_SCHEDULER_LEASE_MS,
    Math.max(sceneSchedulerIntervalMs * 2, 60_000),
    "SCENE_SCHEDULER_LEASE_MS"
  );
  const sceneActionWorkerIntervalMs = parsePositiveIntegerEnv(
    process.env.SCENE_ACTION_WORKER_INTERVAL_MS,
    5_000,
    "SCENE_ACTION_WORKER_INTERVAL_MS"
  );
  const sceneActionWorkerBatchSize = parsePositiveIntegerEnv(
    process.env.SCENE_ACTION_WORKER_BATCH_SIZE,
    25,
    "SCENE_ACTION_WORKER_BATCH_SIZE"
  );
  const sceneActionWorkerVisibilityTimeoutMs = parsePositiveIntegerEnv(
    process.env.SCENE_ACTION_WORKER_VISIBILITY_TIMEOUT_MS,
    Math.max(sceneActionWorkerIntervalMs * 3, 30_000),
    "SCENE_ACTION_WORKER_VISIBILITY_TIMEOUT_MS"
  );
  const sceneRuntimeWorkerIntervalMs = parsePositiveIntegerEnv(
    process.env.SCENE_RUNTIME_WORKER_INTERVAL_MS,
    5_000,
    "SCENE_RUNTIME_WORKER_INTERVAL_MS"
  );
  const otaDeliveryWorkerIntervalMs = parsePositiveIntegerEnv(
    process.env.OTA_DELIVERY_WORKER_INTERVAL_MS,
    5_000,
    "OTA_DELIVERY_WORKER_INTERVAL_MS"
  );
  // Dead-man's-switch for device connectivity (device.service.ts's
  // sweepStaleDevicesOffline) -- covers what LWT structurally can't: a
  // device that never established an MQTT session under its current
  // credentials at all, or one whose registered will was dropped by a
  // broker restart. 60s poll, 5-minute staleness (~10x a typical 30s
  // telemetry interval, generous enough to not false-positive on jitter).
  const deviceOfflineSweepIntervalMs = parsePositiveIntegerEnv(
    process.env.DEVICE_OFFLINE_SWEEP_INTERVAL_MS,
    60_000,
    "DEVICE_OFFLINE_SWEEP_INTERVAL_MS"
  );
  const deviceOfflineStaleAfterMs = parsePositiveIntegerEnv(
    process.env.DEVICE_OFFLINE_STALE_AFTER_MS,
    300_000,
    "DEVICE_OFFLINE_STALE_AFTER_MS"
  );
  const otaDeliveryWorkerBatchSize = parsePositiveIntegerEnv(
    process.env.OTA_DELIVERY_WORKER_BATCH_SIZE,
    25,
    "OTA_DELIVERY_WORKER_BATCH_SIZE"
  );
  const otaDeliveryWorkerVisibilityTimeoutMs = parsePositiveIntegerEnv(
    process.env.OTA_DELIVERY_WORKER_VISIBILITY_TIMEOUT_MS,
    Math.max(otaDeliveryWorkerIntervalMs * 3, 30_000),
    "OTA_DELIVERY_WORKER_VISIBILITY_TIMEOUT_MS"
  );
  const sceneRuntimeWorkerBatchSize = parsePositiveIntegerEnv(
    process.env.SCENE_RUNTIME_WORKER_BATCH_SIZE,
    25,
    "SCENE_RUNTIME_WORKER_BATCH_SIZE"
  );
  const sceneRuntimeWorkerVisibilityTimeoutMs = parsePositiveIntegerEnv(
    process.env.SCENE_RUNTIME_WORKER_VISIBILITY_TIMEOUT_MS,
    Math.max(sceneRuntimeWorkerIntervalMs * 3, 30_000),
    "SCENE_RUNTIME_WORKER_VISIBILITY_TIMEOUT_MS"
  );
  const sceneSchedulerInstanceId =
    process.env.SCENE_SCHEDULER_INSTANCE_ID?.trim() || undefined;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  const mqttRuntimeEnabled = parseBooleanEnv(
    process.env.MQTT_RUNTIME_ENABLED,
    false
  );

  if (mqttRuntimeEnabled && !mqttUrl) {
    throw new Error("MQTT_RUNTIME_ENABLED=true requires MQTT_URL");
  }

  if (homePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("HOME_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (authPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("AUTH_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (scenePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("SCENE_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (notificationPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("NOTIFICATION_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (pidPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("PID_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (uiPackagePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("UI_PACKAGE_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (nurseCallReceiverPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error(
      "NURSE_CALL_RECEIVER_PERSISTENCE_MODE=mongodb requires MONGODB_URI"
    );
  }

  if (smartRfTransmitterPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error(
      "SMART_RF_TRANSMITTER_PERSISTENCE_MODE=mongodb requires MONGODB_URI"
    );
  }

  if (tokenDispenserPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error(
      "TOKEN_DISPENSER_PERSISTENCE_MODE=mongodb requires MONGODB_URI"
    );
  }

  if (p10DisplayPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("P10_DISPLAY_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (sosSirenPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("SOS_SIREN_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (devicePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("DEVICE_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (provisioningPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("PROVISIONING_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (otaPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("OTA_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (apiAccessPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("API_ACCESS_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (sceneSchedulerCoordinationMode === "mongodb-lock" && !mongodbUri) {
    throw new Error(
      "SCENE_SCHEDULER_COORDINATION_MODE=mongodb-lock requires MONGODB_URI"
    );
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port,
    ...(mongodbUri ? { mongodbUri } : {}),
    ...(googleClientId ? { googleClientId } : {}),
    mqttRuntimeEnabled,
    ...(mqttUrl ? { mqttUrl } : {}),
    ...(mqttUsername ? { mqttUsername } : {}),
    ...(mqttPassword ? { mqttPassword } : {}),
    mqttClientId,
    mqttScheduleTopic,
    mqttNotificationTopic,
    authPersistenceMode,
    matterRuntimeEnabled: parseBooleanEnv(
      process.env.MATTER_RUNTIME_ENABLED,
      false
    ),
    homePersistenceMode,
    pidPersistenceMode,
    uiPackagePersistenceMode,
    nurseCallReceiverPersistenceMode,
    smartRfTransmitterPersistenceMode,
    tokenDispenserPersistenceMode,
    p10DisplayPersistenceMode,
    sosSirenPersistenceMode,
    devicePersistenceMode,
    provisioningPersistenceMode,
    otaPersistenceMode,
    apiAccessPersistenceMode,
    scenePersistenceMode,
    notificationPersistenceMode,
    sceneSchedulerEnabled: parseBooleanEnv(
      process.env.SCENE_SCHEDULER_ENABLED,
      true
    ),
    sceneSchedulerCoordinationMode,
    ...(sceneSchedulerInstanceId ? { sceneSchedulerInstanceId } : {}),
    sceneSchedulerIntervalMs,
    sceneSchedulerLeaseMs,
    sceneActionWorkerEnabled: parseBooleanEnv(
      process.env.SCENE_ACTION_WORKER_ENABLED,
      true
    ),
    sceneActionWorkerIntervalMs,
    sceneActionWorkerBatchSize,
    sceneActionWorkerVisibilityTimeoutMs,
    otaDeliveryWorkerEnabled: parseBooleanEnv(
      process.env.OTA_DELIVERY_WORKER_ENABLED,
      true
    ),
    otaDeliveryWorkerIntervalMs,
    otaDeliveryWorkerBatchSize,
    otaDeliveryWorkerVisibilityTimeoutMs,
    sceneRuntimeWorkerEnabled: parseBooleanEnv(
      process.env.SCENE_RUNTIME_WORKER_ENABLED,
      true
    ),
    sceneRuntimeWorkerIntervalMs,
    sceneRuntimeWorkerBatchSize,
    sceneRuntimeWorkerVisibilityTimeoutMs,
    deviceOfflineSweepIntervalMs,
    deviceOfflineStaleAfterMs
  };
}
