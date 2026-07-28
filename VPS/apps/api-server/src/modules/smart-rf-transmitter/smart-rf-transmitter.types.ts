export type SmartRfProfileMode = "INCHING" | "LATCHING" | "TOGGLE";
export type SmartRfTriggerAction = "TRIGGER" | "TURN_ON" | "TURN_OFF" | "TOGGLE";
export type SmartRfLogSource =
  | "PWA"
  | "Local"
  | "ESP-NOW"
  | "Scene"
  | "MQTT"
  | "BUTTON"
  | "SYSTEM";

export interface SmartRfButtonProfile {
  profileId: number;
  deviceId: string;
  enabled: boolean;
  name: string;
  rfCodeHex: string;
  remoteIdHex: string;
  buttonCode: number;
  bitLength: number;
  pulseWidthUs: number;
  repeatCount: number;
  pulseDurationMs: number;
  cooldownMs: number;
  mode: SmartRfProfileMode;
  assumedStateAfterTrigger: string;
  persistState: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmartRfCommandLogRecord {
  logId: string;
  deviceId: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  source: SmartRfLogSource;
  topic?: string;
  profileId?: number;
  requestId?: string;
  userId?: string;
  detail?: string;
  payload?: Record<string, unknown>;
}

export interface SmartRfConfigPatch {
  deviceName?: string;
  productProfile?: string;
  wifiSsid?: string;
  wifiPassword?: string;
  clearWifi?: boolean;
  mqttHost?: string;
  mqttPort?: number;
  mqttUsername?: string;
  mqttPassword?: string;
  clearMqttPassword?: boolean;
  mqttTopicRoot?: string;
  cloudEnabled?: boolean;
  espnowEnabled?: boolean;
  localApiAuthEnabled?: boolean;
  localApiPin?: string;
  rfDataPin?: number;
}

export interface SmartRfProfileInput {
  profileId: number;
  enabled?: boolean;
  name?: string;
  rfCodeHex?: string;
  remoteIdHex?: string;
  buttonCode?: number;
  bitLength?: number;
  pulseWidthUs?: number;
  repeatCount?: number;
  pulseDurationMs?: number;
  cooldownMs?: number;
  mode?: SmartRfProfileMode;
  assumedStateAfterTrigger?: string;
  persistState?: boolean;
}

export class SmartRfTransmitterModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "SmartRfTransmitterModuleError";
  }
}
