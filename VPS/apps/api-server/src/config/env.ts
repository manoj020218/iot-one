export interface AppConfig {
  nodeEnv: string;
  port: number;
}

export function readAppConfig(): AppConfig {
  const rawPort = process.env.PORT ?? "4000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port
  };
}
