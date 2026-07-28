export type SosSirenLogSource = "PWA" | "Scene" | "MQTT";

export interface SosSirenLogRecord {
  logId: string;
  deviceId: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  source: SosSirenLogSource;
  userId?: string;
  detail?: string;
}

/**
 * Every value here must already exist in @jenix/shared's SceneActionCommand
 * union (RuntimeDeviceCommandMessage.command is typed against it) — reusing
 * "alarm_test"/"apply_settings"/"restart"/"factory_reset" where the meaning
 * already fits, adding only "trigger_alarm"/"stop_alarm" as genuinely new.
 */
export type SosSirenDeviceCommand =
  | "trigger_alarm"
  | "stop_alarm"
  | "alarm_test"
  | "apply_settings"
  | "restart"
  | "factory_reset";

export class SosSirenModuleError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "SosSirenModuleError";
  }
}
