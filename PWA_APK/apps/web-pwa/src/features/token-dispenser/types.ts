export type PrinterStatus =
  | "IDLE"
  | "PRINTING"
  | "PAPER_LOW"
  | "PAPER_OUT"
  | "OFFLINE"
  | "ERROR"
  | "OVERHEAT";

export interface TokenDispenserState {
  deviceId: string;
  online: boolean;
  currentToken: string;
  lastPrintedToken: string;
  lastPrintedAt?: string;
  printStatus: "IDLE" | "PRINTING" | "DONE" | "FAILED";
  printerStatus: PrinterStatus;
  paperLow: boolean;
  estimatedTokensLeft: number;
  tokensPrintedSinceRollReset: number;
  mqttStatus: "CONNECTED" | "DISCONNECTED";
  httpFallback: boolean;
  espNowStatus: "ACTIVE" | "INACTIVE";
  wifiRssi: number;
  uptimeSec: number;
  firmwareVersion: string;
  lastSeen: string;
  lastError?: string;
}

export interface PrintTemplate {
  header: string;
  queueName: string;
  tokenPrefix: string;
  showDateTime: boolean;
  showQr: boolean;
  qrPayload: string;
  footer: string;
}

export interface TokenDispenserLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  source: "PWA" | "Local" | "ESP-NOW" | "Scene" | "MQTT" | "BUTTON" | "Device";
  userId?: string;
  oldValue?: string;
  newValue?: string;
  deliveryId?: string;
  details?: string;
  eventSource?: string;
}

export const SCENE_CAPABILITIES = {
  triggers: [
    "token_printed",
    "token_number_changed",
    "paper_low",
    "paper_out",
    "printer_error",
    "device_offline",
    "roll_reset",
  ],
  actions: [
    "print_next_token",
    "print_custom_json",
    "reset_roll_counter",
    "set_token_counter",
    "test_print",
  ],
  readableValues: [
    "current_token",
    "last_printed_token",
    "estimated_tokens_left",
    "paper_low",
    "printer_status",
  ],
} as const;
