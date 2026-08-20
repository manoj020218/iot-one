import type { StreamerDestinationRecord } from "./destination.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface DestinationRepository {
  listByHome(homeId: string): Promise<StreamerDestinationRecord[]>;
  get(destinationId: string): Promise<StreamerDestinationRecord | undefined>;
  save(record: StreamerDestinationRecord): Promise<StreamerDestinationRecord>;
  remove(destinationId: string): Promise<void>;
  reset(): Promise<void>;
}

function createInMemoryDestinationRepository(): DestinationRepository {
  const store = new Map<string, StreamerDestinationRecord>();

  return {
    async listByHome(homeId) {
      return Array.from(store.values(), clone).filter(
        (destination) => destination.homeId === homeId
      );
    },
    async get(destinationId) {
      const record = store.get(destinationId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.destinationId, clone(record));
      return clone(record);
    },
    async remove(destinationId) {
      store.delete(destinationId);
    },
    async reset() {
      store.clear();
    }
  };
}

export const destinationRepository: DestinationRepository = createInMemoryDestinationRepository();

export async function resetDestinationStore(): Promise<void> {
  await destinationRepository.reset();
}
