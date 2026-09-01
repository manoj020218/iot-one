import type { TokenDispenserState, TokenDispenserLog, PrintTemplate } from "./types";

export const MOCK_STATE: TokenDispenserState = {
  deviceId: "JNX-10003BCC0764",
  online: true,
  currentToken: "A025",
  lastPrintedToken: "A024",
  lastPrintedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  printStatus: "IDLE",
  printerStatus: "IDLE",
  paperLow: false,
  estimatedTokensLeft: 218,
  tokensPrintedSinceRollReset: 282,
  mqttStatus: "CONNECTED",
  httpFallback: false,
  espNowStatus: "ACTIVE",
  wifiRssi: -62,
  uptimeSec: 7200,
  firmwareVersion: "v1.0.0",
  lastSeen: new Date().toISOString()
};

export const MOCK_TEMPLATE: PrintTemplate = {
  header: "JENIX QUEUE",
  queueName: "Service Counter",
  tokenPrefix: "A",
  showDateTime: true,
  showQr: true,
  qrPayload: "{{deviceId}}/{{token_number}}",
  footer: "Please wait for your turn"
};

export const MOCK_LOGS: TokenDispenserLog[] = [
  {
    id: "log-001",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    level: "info",
    action: "PRINT_NEXT_TOKEN",
    source: "BUTTON",
    newValue: "A024"
  },
  {
    id: "log-002",
    timestamp: new Date(Date.now() - 60000).toISOString(),
    level: "info",
    action: "TEST_PRINT",
    source: "PWA",
    userId: "user-001"
  },
  {
    id: "log-003",
    timestamp: new Date(Date.now() - 300000).toISOString(),
    level: "warn",
    action: "PAPER_LOW_ALERT",
    source: "MQTT"
  }
];
