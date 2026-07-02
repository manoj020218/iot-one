import type { DeviceRecord } from "@jenix/shared";

const deviceDemoStore = new Map<string, DeviceRecord[]>();

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createKey(userId: string, homeId: string) {
  return `${userId}:${homeId}`;
}

export function listDemoDevices(userId: string, homeId: string): DeviceRecord[] {
  return clone(deviceDemoStore.get(createKey(userId, homeId)) ?? []);
}

export function setDemoDevices(
  userId: string,
  homeId: string,
  devices: DeviceRecord[]
) {
  deviceDemoStore.set(createKey(userId, homeId), clone(devices));
}

export function upsertDemoDevice(
  userId: string,
  homeId: string,
  device: DeviceRecord
) {
  const devices = listDemoDevices(userId, homeId);
  const nextDevices = [
    device,
    ...devices.filter((item) => item.deviceId !== device.deviceId)
  ];

  setDemoDevices(userId, homeId, nextDevices);
}

export function resetDemoDevices() {
  deviceDemoStore.clear();
}
