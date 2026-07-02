export interface AppConfig {
  nodeEnv: string;
  port: number;
  mongodbUri?: string;
  matterRuntimeEnabled: boolean;
  scenePersistenceMode: "memory" | "mongodb";
  sceneSchedulerEnabled: boolean;
  sceneSchedulerCoordinationMode: "local" | "mongodb-lock";
  sceneSchedulerInstanceId?: string;
  sceneSchedulerIntervalMs: number;
  sceneSchedulerLeaseMs: number;
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

function parseScenePersistenceMode(
  rawValue: string | undefined,
  hasMongoUri: boolean
): "memory" | "mongodb" {
  if (rawValue === undefined) {
    return hasMongoUri ? "mongodb" : "memory";
  }

  if (rawValue === "memory" || rawValue === "mongodb") {
    return rawValue;
  }

  throw new Error(`Invalid SCENE_PERSISTENCE_MODE value: ${rawValue}`);
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
  const scenePersistenceMode = parseScenePersistenceMode(
    process.env.SCENE_PERSISTENCE_MODE,
    Boolean(mongodbUri)
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
  const sceneSchedulerInstanceId =
    process.env.SCENE_SCHEDULER_INSTANCE_ID?.trim() || undefined;

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  if (scenePersistenceMode === "mongodb" && !mongodbUri) {
    throw new Error("SCENE_PERSISTENCE_MODE=mongodb requires MONGODB_URI");
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
    matterRuntimeEnabled: parseBooleanEnv(
      process.env.MATTER_RUNTIME_ENABLED,
      false
    ),
    scenePersistenceMode,
    sceneSchedulerEnabled: parseBooleanEnv(
      process.env.SCENE_SCHEDULER_ENABLED,
      true
    ),
    sceneSchedulerCoordinationMode,
    ...(sceneSchedulerInstanceId ? { sceneSchedulerInstanceId } : {}),
    sceneSchedulerIntervalMs,
    sceneSchedulerLeaseMs
  };
}
