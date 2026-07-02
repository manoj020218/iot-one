export interface TelemetryFieldDefinition {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
}

export const sampleTelemetryFields: TelemetryFieldDefinition[] = [
  {
    key: "tankLevelMm",
    label: "Tank Level",
    unit: "mm",
    min: 0
  },
  {
    key: "signalStrength",
    label: "Signal Strength",
    unit: "dBm"
  }
];
