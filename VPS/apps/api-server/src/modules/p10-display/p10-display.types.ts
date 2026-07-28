export type P10DisplayLogSource = "PWA" | "Local" | "Scene" | "MQTT" | "BUTTON";

export interface P10DisplayLogRecord {
  logId: string;
  deviceId: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  source: P10DisplayLogSource;
  userId?: string;
  requestId?: string;
  detail?: string;
}

export class P10DisplayModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "P10DisplayModuleError";
  }
}
