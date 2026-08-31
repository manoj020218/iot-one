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
 * Per-device MQTT connection labels the OLD jenix/{tenantId}/{siteId}/
 * {deviceId}/{suffix} scheme used. Token Dispenser itself moved to the
 * canonical jnx/{tenantId}/{pid}/{deviceId}/{suffix} scheme and no longer
 * needs this — kept only because Billing Dispenser (same firmware family,
 * relaunched as its own product, see billing-dispenser.service.ts) still
 * dispatches commands over the old scheme and reuses this store.
 */
export interface TokenDispenserConnectionConfig {
  deviceId: string;
  mqttTenantId: string;
  mqttSiteId: string;
}

export class TokenDispenserModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "TokenDispenserModuleError";
  }
}
