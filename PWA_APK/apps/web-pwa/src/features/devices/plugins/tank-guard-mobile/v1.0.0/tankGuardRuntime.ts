import type { DeviceUiRuntimeState } from "@jenix/shared";

export interface TankGuardSettingsDraft {
  config: {
    capacityLitres: number;
    wifiTxPowerDbm: number;
    zeroLevelMm: number;
    bottomMotorStartLevelMm: number;
    topMotorOffLevelMm: number;
    overflowMarginMm: number;
  };
  alarm: {
    repeatEnabled: boolean;
    repeatMinutes: number;
    lowLevelPct: number;
    notifyOnSensorFault: boolean;
  };
  actions: {
    powerRestoreWaitMinutes: number;
    motorStartConfirmMinutes: number;
    motorOffConfirmMinutes: number;
    rfOnPulseMs: number;
    rfOffPulseMs: number;
    rfAlarmPulseMs: number;
  };
}

export const defaultTankGuardSettings: TankGuardSettingsDraft = {
  config: {
    capacityLitres: 1000,
    wifiTxPowerDbm: 8.5,
    zeroLevelMm: 0,
    bottomMotorStartLevelMm: 300,
    topMotorOffLevelMm: 900,
    overflowMarginMm: 30
  },
  alarm: {
    repeatEnabled: true,
    repeatMinutes: 2,
    lowLevelPct: 20,
    notifyOnSensorFault: true
  },
  actions: {
    powerRestoreWaitMinutes: 3,
    motorStartConfirmMinutes: 3,
    motorOffConfirmMinutes: 3,
    rfOnPulseMs: 500,
    rfOffPulseMs: 500,
    rfAlarmPulseMs: 500
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function readTankGuardSettings(
  runtime: DeviceUiRuntimeState
): TankGuardSettingsDraft {
  const value = isRecord(runtime.settings) ? runtime.settings : {};
  const config = isRecord(value.config) ? value.config : {};
  const alarm = isRecord(value.alarm) ? value.alarm : {};
  const actions = isRecord(value.actions) ? value.actions : {};

  return {
    config: {
      capacityLitres: readNumber(config.capacityLitres, 1000),
      wifiTxPowerDbm: readNumber(config.wifiTxPowerDbm, 8.5),
      zeroLevelMm: readNumber(config.zeroLevelMm, 0),
      bottomMotorStartLevelMm: readNumber(config.bottomMotorStartLevelMm, 300),
      topMotorOffLevelMm: readNumber(config.topMotorOffLevelMm, 900),
      overflowMarginMm: readNumber(config.overflowMarginMm, 30)
    },
    alarm: {
      repeatEnabled: readBoolean(alarm.repeatEnabled, true),
      repeatMinutes: readNumber(alarm.repeatMinutes, 2),
      lowLevelPct: readNumber(alarm.lowLevelPct, 20),
      notifyOnSensorFault: readBoolean(alarm.notifyOnSensorFault, true)
    },
    actions: {
      powerRestoreWaitMinutes: readNumber(actions.powerRestoreWaitMinutes, 3),
      motorStartConfirmMinutes: readNumber(actions.motorStartConfirmMinutes, 3),
      motorOffConfirmMinutes: readNumber(actions.motorOffConfirmMinutes, 3),
      rfOnPulseMs: readNumber(actions.rfOnPulseMs, 500),
      rfOffPulseMs: readNumber(actions.rfOffPulseMs, 500),
      rfAlarmPulseMs: readNumber(actions.rfAlarmPulseMs, 500)
    }
  };
}

export function readTankGuardSnapshot(
  runtime: DeviceUiRuntimeState,
  settings: TankGuardSettingsDraft
) {
  const telemetry = runtime.telemetrySnapshot.telemetry;

  return {
    levelPct: readNumber(telemetry.tankLevelPct),
    waterLevelMm: readNumber(telemetry.tankLevelMm),
    zeroLevelMm: readNumber(telemetry.zeroLevelMm, settings.config.zeroLevelMm),
    flowLitresPerMin: readNumber(telemetry.flowLitresPerMin),
    rssiDbm: readNumber(telemetry.wifiRssi, -127),
    wifiSsid: readString(telemetry.wifiSsidName),
    localIp: readString(telemetry.localIp),
    localUrl: readString(telemetry.localUrl),
    wifiTxPowerDbm: readNumber(
      telemetry.wifiTxPowerDbm,
      settings.config.wifiTxPowerDbm
    ),
    pumpRunning: readBoolean(telemetry.pumpRunning),
    alarmState: readString(telemetry.alarmState, "normal"),
    sensorStatus: readString(telemetry.sensorStatus, "unknown"),
    occurredAt: runtime.telemetrySnapshot.occurredAt
  };
}
