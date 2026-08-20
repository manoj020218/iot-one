import { QRUNLOCK_PID } from "../constants";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { rfRemoteRepository } from "./rf-remote.model";
import type { RfRemoteRecord } from "./rf-remote.types";
import { QrunlockRfRemoteError } from "./rf-remote.types";

async function requireQrunlockDevice(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<void> {
  const device = await deps.getDevice(deviceId, context);
  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockRfRemoteError(404, "DEVICE_NOT_FOUND", `Not a QRunlock device: ${deviceId}`);
  }
}

export async function listRfRemotes(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<RfRemoteRecord[]> {
  await requireQrunlockDevice(deps, deviceId, context);
  return rfRemoteRepository.list(deviceId);
}

/**
 * "Adding" a remote here means recording that the user paired one — see
 * IOT_Device/QRunlock/VPS/API_CONTRACT.md §3: there is no MQTT ack from
 * firmware confirming an RF pairing actually succeeded (PROVISIONING.md
 * §9, item 9), so this is the user's own bookkeeping of remotes they
 * believe they paired during an rf-learning/start window, not a
 * hardware-confirmed registration.
 */
export async function addRfRemote(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext,
  name: string | undefined
): Promise<RfRemoteRecord> {
  await requireQrunlockDevice(deps, deviceId, context);
  const existing = await rfRemoteRepository.list(deviceId);
  const finalName = name?.trim() || `Remote ${existing.length + 1}`;
  return rfRemoteRepository.add(deviceId, finalName);
}

export async function renameRfRemote(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext,
  remoteId: string,
  name: string
): Promise<RfRemoteRecord> {
  await requireQrunlockDevice(deps, deviceId, context);
  const updated = await rfRemoteRepository.rename(deviceId, remoteId, name);
  if (!updated) {
    throw new QrunlockRfRemoteError(404, "REMOTE_NOT_FOUND", `Remote not found: ${remoteId}`);
  }
  return updated;
}

export async function deleteRfRemote(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext,
  remoteId: string
): Promise<{ remoteId: string }> {
  await requireQrunlockDevice(deps, deviceId, context);
  const removed = await rfRemoteRepository.remove(deviceId, remoteId);
  if (!removed) {
    throw new QrunlockRfRemoteError(404, "REMOTE_NOT_FOUND", `Remote not found: ${remoteId}`);
  }
  return { remoteId };
}
