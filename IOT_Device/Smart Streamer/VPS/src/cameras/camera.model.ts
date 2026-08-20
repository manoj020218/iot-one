import type { CameraTestSession, StreamerCameraRecord } from "./camera.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface CameraRepository {
  listByHome(homeId: string): Promise<StreamerCameraRecord[]>;
  get(cameraId: string): Promise<StreamerCameraRecord | undefined>;
  save(record: StreamerCameraRecord): Promise<StreamerCameraRecord>;
  remove(cameraId: string): Promise<void>;
  findByAssignedDevice(deviceId: string): Promise<StreamerCameraRecord | undefined>;
  reset(): Promise<void>;
}

export interface CameraTestRepository {
  save(session: CameraTestSession): Promise<CameraTestSession>;
  get(testId: string): Promise<CameraTestSession | undefined>;
  reset(): Promise<void>;
}

function createInMemoryCameraRepository(): CameraRepository {
  const store = new Map<string, StreamerCameraRecord>();

  return {
    async listByHome(homeId) {
      return Array.from(store.values(), clone).filter((camera) => camera.homeId === homeId);
    },
    async get(cameraId) {
      const record = store.get(cameraId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.cameraId, clone(record));
      return clone(record);
    },
    async remove(cameraId) {
      store.delete(cameraId);
    },
    async findByAssignedDevice(deviceId) {
      const match = Array.from(store.values()).find(
        (camera) => camera.assignedDeviceId === deviceId
      );
      return match ? clone(match) : undefined;
    },
    async reset() {
      store.clear();
    }
  };
}

function createInMemoryCameraTestRepository(): CameraTestRepository {
  const store = new Map<string, CameraTestSession>();

  return {
    async save(session) {
      store.set(session.testId, clone(session));
      return clone(session);
    },
    async get(testId) {
      const record = store.get(testId);
      return record ? clone(record) : undefined;
    },
    async reset() {
      store.clear();
    }
  };
}

export const cameraRepository: CameraRepository = createInMemoryCameraRepository();
export const cameraTestRepository: CameraTestRepository = createInMemoryCameraTestRepository();

export async function resetCameraStore(): Promise<void> {
  await cameraRepository.reset();
  await cameraTestRepository.reset();
}

/** Used by devices/device.service.ts to fill in assignedCameraId. */
export async function getCameraIdAssignedToDevice(deviceId: string): Promise<string | null> {
  const camera = await cameraRepository.findByAssignedDevice(deviceId);
  return camera?.cameraId ?? null;
}
