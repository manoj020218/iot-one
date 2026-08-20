import type { StreamerScheduleRecord } from "./schedule.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface ScheduleRepository {
  listByHome(homeId: string): Promise<StreamerScheduleRecord[]>;
  listByDevice(deviceId: string): Promise<StreamerScheduleRecord[]>;
  get(scheduleId: string): Promise<StreamerScheduleRecord | undefined>;
  save(record: StreamerScheduleRecord): Promise<StreamerScheduleRecord>;
  remove(scheduleId: string): Promise<void>;
  reset(): Promise<void>;
}

function createInMemoryScheduleRepository(): ScheduleRepository {
  const store = new Map<string, StreamerScheduleRecord>();

  return {
    async listByHome(homeId) {
      return Array.from(store.values(), clone).filter((schedule) => schedule.homeId === homeId);
    },
    async listByDevice(deviceId) {
      return Array.from(store.values(), clone).filter((schedule) => schedule.deviceId === deviceId);
    },
    async get(scheduleId) {
      const record = store.get(scheduleId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.scheduleId, clone(record));
      return clone(record);
    },
    async remove(scheduleId) {
      store.delete(scheduleId);
    },
    async reset() {
      store.clear();
    }
  };
}

export const scheduleRepository: ScheduleRepository = createInMemoryScheduleRepository();

export async function resetScheduleStore(): Promise<void> {
  await scheduleRepository.reset();
}
