/**
 * Lets a device plugin (e.g. @jenix/qrunlock-backend) register PID-specific
 * behavior for the public vendor API, without api-access ever importing a
 * plugin package directly — app.ts (the one place already allowed to know
 * about every mounted plugin) registers these after mounting each plugin,
 * the same way it wires platform-api.ts deps into each plugin's router
 * factory. This keeps the dependency direction correct: plugins depend on
 * platform, platform never depends on a specific plugin.
 *
 * `executeCommand` is the important one — see
 * IOT_Device/QRunlock/VPS/HANDOFF.md and RELAY_INTEGRATION_PLAN.md: a
 * vendor-triggered command MUST go through the plugin's own guarded
 * service function (cooldown checks, activity logging), never a raw
 * generic device-command dispatch, "no matter who is calling." If a PID
 * has no registered capability, executePublicDeviceCommand falls back to
 * the pre-existing generic scene-command dispatch.
 */
export interface PublicDeviceCapabilities {
  getConfig?: (deviceId: string, homeId: string) => Promise<unknown>;
  patchConfig?: (deviceId: string, homeId: string, patch: Record<string, unknown>) => Promise<unknown>;
  getLogs?: (deviceId: string, homeId: string, limit: number) => Promise<unknown[]>;
  /** `caller` is always platform-controlled (e.g. "api:{packageId}"), never client-supplied. */
  executeCommand?: (
    deviceId: string,
    homeId: string,
    command: string,
    payload: Record<string, unknown>,
    caller: string
  ) => Promise<Record<string, unknown>>;
}

const registry = new Map<string, PublicDeviceCapabilities>();

function normalizePid(pid: string): string {
  return pid.trim().toUpperCase();
}

export function registerPublicDeviceCapabilities(pid: string, capabilities: PublicDeviceCapabilities): void {
  registry.set(normalizePid(pid), capabilities);
}

export function getPublicDeviceCapabilities(pid: string): PublicDeviceCapabilities | undefined {
  return registry.get(normalizePid(pid));
}

export function resetPublicDeviceCapabilities(): void {
  registry.clear();
}
