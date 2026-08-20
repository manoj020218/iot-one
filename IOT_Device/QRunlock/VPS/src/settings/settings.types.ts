/**
 * relayStateAfterPowerRestore and switchType are NOT implemented in
 * firmware today — IOT_Device/QRunlock/src/config/ConfigTypes.h /
 * Defaults.h have no fields for either concept, only relayPulseMs and
 * relayCooldownMs. They're modeled here (stored, validated, returned) so
 * the frontend contract is stable, but — same honesty as
 * settings.service.ts's `sync_settings` dispatch — writing them has no
 * effect on a real device yet. See HANDOFF.md "Known limits" before
 * treating either as functional.
 */
export type RelayPowerRestoreMode = "on" | "off" | "remember";
export type SwitchType = "reset" | "toggle" | "state";

export interface QrunlockDeviceSettings {
  deviceId: string;
  relayPulseMs: number;
  relayCooldownMs: number;
  relayStateAfterPowerRestore: RelayPowerRestoreMode;
  switchType: SwitchType;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  relayCooldownMs?: number;
  relayStateAfterPowerRestore?: RelayPowerRestoreMode;
  switchType?: SwitchType;
}

export class QrunlockSettingsError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "QrunlockSettingsError";
  }
}
