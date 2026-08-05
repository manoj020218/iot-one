import type { NotificationRecord } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface NotificationRepository {
  get(notificationId: string): Promise<NotificationRecord | undefined>;
  listByHome(homeId: string): Promise<NotificationRecord[]>;
  save(record: NotificationRecord): Promise<NotificationRecord>;
  remove(notificationId: string): Promise<void>;
  reset(): Promise<void>;
}

export interface NotificationPersistenceStore {
  notifications: NotificationRepository;
}

function sortNewestFirst(records: NotificationRecord[]): NotificationRecord[] {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createInMemoryNotificationPersistenceStore(): NotificationPersistenceStore {
  const store = new Map<string, NotificationRecord>();

  const notifications: NotificationRepository = {
    async get(notificationId) {
      const record = store.get(notificationId);
      return record ? clone(record) : undefined;
    },
    async listByHome(homeId) {
      return sortNewestFirst(
        Array.from(store.values()).filter((record) => record.homeId === homeId)
      ).map(clone);
    },
    async save(record) {
      store.set(record.notificationId, clone(record));
      return clone(record);
    },
    async remove(notificationId) {
      store.delete(notificationId);
    },
    async reset() {
      store.clear();
    }
  };

  return { notifications };
}

let activeNotificationPersistenceStore: NotificationPersistenceStore =
  createInMemoryNotificationPersistenceStore();

export function useNotificationPersistenceStore(store: NotificationPersistenceStore) {
  activeNotificationPersistenceStore = store;
}

export function resetNotificationPersistenceStore() {
  activeNotificationPersistenceStore = createInMemoryNotificationPersistenceStore();
}

export const notificationRepository: NotificationRepository = {
  get(notificationId) {
    return activeNotificationPersistenceStore.notifications.get(notificationId);
  },
  listByHome(homeId) {
    return activeNotificationPersistenceStore.notifications.listByHome(homeId);
  },
  save(record) {
    return activeNotificationPersistenceStore.notifications.save(record);
  },
  remove(notificationId) {
    return activeNotificationPersistenceStore.notifications.remove(notificationId);
  },
  reset() {
    return activeNotificationPersistenceStore.notifications.reset();
  }
};
