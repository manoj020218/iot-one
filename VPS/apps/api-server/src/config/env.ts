export interface AppConfig {
  nodeEnv: string;
  port: number;
  sceneSchedulerEnabled: boolean;
  sceneSchedulerIntervalMs: number;
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

export function readAppConfig(): AppConfig {
  const rawPort = process.env.PORT ?? "4000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port,
    sceneSchedulerEnabled: parseBooleanEnv(
      process.env.SCENE_SCHEDULER_ENABLED,
      true
    ),
    sceneSchedulerIntervalMs: parsePositiveIntegerEnv(
      process.env.SCENE_SCHEDULER_INTERVAL_MS,
      30_000,
      "SCENE_SCHEDULER_INTERVAL_MS"
    )
  };
}
