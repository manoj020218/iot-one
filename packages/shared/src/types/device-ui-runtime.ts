export type DeviceUiPrimitive = boolean | number | string;

export interface DeviceUiTelemetrySnapshotRecord {
  deviceId: string;
  pid: string;
  occurredAt: string;
  telemetry: Record<string, DeviceUiPrimitive>;
  history?: number[];
}

export interface DeviceUiCommandRequest {
  command: string;
  payload?: Record<string, unknown>;
  requiresAck?: boolean;
}

export interface DeviceUiCommandAckRecord {
  commandId: string;
  deviceId: string;
  status: "queued" | "completed" | "failed";
  queuedAt: string;
  acknowledgedAt?: string;
  errorMessage?: string;
  payload?: Record<string, unknown>;
}

export interface DeviceUiRuntimeState {
  deviceId: string;
  pid: string;
  telemetrySnapshot: DeviceUiTelemetrySnapshotRecord;
  settings?: Record<string, unknown>;
  lastCommand?: DeviceUiCommandAckRecord;
}
