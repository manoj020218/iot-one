export type TokenDispenserLogSource = "PWA" | "Local" | "ESP-NOW" | "Scene" | "MQTT" | "BUTTON";

export interface TokenDispenserPrintTemplate {
  header: string;
  queueName: string;
  tokenPrefix: string;
  showDateTime: boolean;
  showQr: boolean;
  qrPayload: string;
  footer: string;
}

export const defaultTokenDispenserPrintTemplate: TokenDispenserPrintTemplate = {
  header: "JENIX QUEUE",
  queueName: "Service Counter",
  tokenPrefix: "A",
  showDateTime: true,
  showQr: true,
  qrPayload: "{{deviceId}}/{{token_number}}",
  footer: "Please wait for your turn"
};

export interface TokenDispenserLogRecord {
  logId: string;
  deviceId: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  source: TokenDispenserLogSource;
  userId?: string;
  requestId?: string;
  oldValue?: string;
  newValue?: string;
  detail?: string;
}

/**
 * Per-device MQTT connection labels this firmware's own NVS config uses to
 * build its topic (jenix/{tenantId}/{siteId}/{deviceId}/{suffix}). These are
 * firmware-local strings, unrelated to the platform's own tenantId (=homeId)
 * concept — kept here purely so the platform can build/match the same topic
 * the device is actually configured with.
 */
export interface TokenDispenserConnectionConfig {
  deviceId: string;
  mqttTenantId: string;
  mqttSiteId: string;
}

export const defaultTokenDispenserConnectionLabel = "default";

export class TokenDispenserModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "TokenDispenserModuleError";
  }
}
