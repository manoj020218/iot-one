import { QRUNLOCK_MAX_RELAY_COOLDOWN_MS, QRUNLOCK_MIN_RELAY_COOLDOWN_MS } from "../constants";
import type { RelayPowerRestoreMode, SwitchType, UpdateSettingsInput } from "./settings.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const POWER_RESTORE_MODES: RelayPowerRestoreMode[] = ["on", "off", "remember"];
const SWITCH_TYPES: SwitchType[] = ["reset", "toggle", "state"];

/**
 * Every field is optional (partial update — PUT here behaves like PATCH),
 * but at least one must be present and every present field must be valid,
 * or the whole request is rejected rather than silently dropping the bad
 * part. relayCooldownMs bounds mirror config::kMaxRelayCooldownMs (10000)
 * and 0 in IOT_Device/QRunlock/src/config/Defaults.h. relayPulseMs is
 * intentionally not accepted here: firmware clamps it to a fixed 300ms
 * today. relayStateAfterPowerRestore/switchType are accepted and stored
 * but not yet wired to firmware — see settings.types.ts.
 */
export function parseUpdateSettingsInput(body: unknown): UpdateSettingsInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const input: UpdateSettingsInput = {};

  if ("relayCooldownMs" in body) {
    const relayCooldownMs = body.relayCooldownMs;
    if (
      typeof relayCooldownMs !== "number" ||
      !Number.isFinite(relayCooldownMs) ||
      relayCooldownMs < QRUNLOCK_MIN_RELAY_COOLDOWN_MS ||
      relayCooldownMs > QRUNLOCK_MAX_RELAY_COOLDOWN_MS
    ) {
      return null;
    }
    input.relayCooldownMs = relayCooldownMs;
  }

  if ("relayStateAfterPowerRestore" in body) {
    const mode = body.relayStateAfterPowerRestore;
    if (typeof mode !== "string" || !POWER_RESTORE_MODES.includes(mode as RelayPowerRestoreMode)) {
      return null;
    }
    input.relayStateAfterPowerRestore = mode as RelayPowerRestoreMode;
  }

  if ("switchType" in body) {
    const type = body.switchType;
    if (typeof type !== "string" || !SWITCH_TYPES.includes(type as SwitchType)) {
      return null;
    }
    input.switchType = type as SwitchType;
  }

  return Object.keys(input).length > 0 ? input : null;
}
