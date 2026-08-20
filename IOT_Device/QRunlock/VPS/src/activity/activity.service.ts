import { QRUNLOCK_PID } from "../constants";
import type { DeviceRequestContext, QrunlockPlatformDeps } from "../platform-deps";
import { activityRepository } from "./activity.model";
import type { QrunlockActivityEvent } from "./activity.types";
import { QrunlockActivityError } from "./activity.types";

export async function listActivity(
  deps: QrunlockPlatformDeps,
  deviceId: string,
  context: DeviceRequestContext
): Promise<QrunlockActivityEvent[]> {
  const device = await deps.getDevice(deviceId, context);
  if (device.pid !== QRUNLOCK_PID) {
    throw new QrunlockActivityError(404, `Not a QRunlock device: ${deviceId}`);
  }

  return activityRepository.list(deviceId);
}
