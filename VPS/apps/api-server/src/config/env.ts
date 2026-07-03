export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri?: string;
  authPersistenceMode: "memory" | "mongodb";
  matterRuntimeEnabled: boolean;
  pidPersistenceMode: "memory" | "mongodb";
  devicePersistenceMode: "memory" | "mongodb";
  homePersistenceMode: "memory" | "mongodb";
  provisioningPersistenceMode: "memory" | "mongodb";
  otaPersistenceMode: "memory" | "mongodb";
  apiAccessPersistenceMode: "memory" | "mongodb";
  scenePersistenceMode: "memory" | "mongodb";
  sceneSchedulerEnabled: boolean;
  sceneSchedulerCoordinationMode: "local" | "mongodb-lock";
  sceneSchedulerInstanceId?: string;
  sceneSchedulerIntervalMs: number;
  sceneSchedulerLeaseMs: number;
  sceneActionWorkerEnabled: boolean;
  sceneActionWorkerIntervalMs: number;
  sceneActionWorkerBatchSize: number;
  sceneActionWorkerVisibilityTimeoutMs: number;
  sceneRuntimeWorkerEnabled: boolean;
  sceneRuntimeWorkerIntervalMs: number;
  sceneRuntimeWorkerBatchSize: number;
  sceneRuntimeWorkerVisibilityTimeoutMs: number;
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

  if (homePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("HOME_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (authPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("AUTH_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (scenePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("SCENE_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
  }

  if (pidPersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("PID_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
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
    authPersistenceMode,
    matterRuntimeEnabled: parseBooleanEnv(
      process.env.MATTER_RUNTIME_ENABLED,
      false
    ),
    homePersistenceMode,
    pidPersistenceMode,
    devicePersistenceMode,
    provisioningPersistenceMode,
    otaPersistenceMode,
    apiAccessPersistenceMode,
    scenePersistenceMode,
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
    sceneRuntimeWorkerEnabled: parseBooleanEnv(
      process.env.SCENE_RUNTIME_WORKER_ENABLED,
      true
    ),
    sceneRuntimeWorkerIntervalMs,
    sceneRuntimeWorkerBatchSize,
    sceneRuntimeWorkerVisibilityTimeoutMs
  };
}
