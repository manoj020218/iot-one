/**
 * Lets a device plugin (e.g. @jenix/qrunlock-backend) handle its own PID's
 * incoming .../events MQTT messages, without runtime.handlers.ts — a
 * platform-core file — ever importing a plugin package directly. Mirrors
 * public-device-capabilities.ts's registry exactly, for the same reason:
 * app.ts (the one place already allowed to know about every mounted
 * plugin) registers a handler after mounting each plugin; platform code
 * never depends on a specific plugin. See that file's own doc comment for
 * the full rationale.
 *
 * handleRuntimeDeviceEventsMessage falls back to its own hardcoded
 * nurse-call-receiver handling when no capability is registered for a
 * PID — that device is a native api-server module, not a plugin package,
 * so it has no reason to go through this registry.
 */
export type DeviceEventHandler = (
  deviceId: string,
  payload: Record<string, unknown>
) => Promise<void>;

const registry = new Map<string, DeviceEventHandler>();

function normalizePid(pid: string): string {
  return pid.trim().toUpperCase();
}

export function registerDeviceEventHandler(pid: string, handler: DeviceEventHandler): void {
  registry.set(normalizePid(pid), handler);
}

export function getDeviceEventHandler(pid: string): DeviceEventHandler | undefined {
  return registry.get(normalizePid(pid));
}

export function resetDeviceEventHandlers(): void {
  registry.clear();
}
