import type { Db } from "mongodb";

import type { NotificationRecord } from "@jenix/shared";

import type { NotificationPersistenceStore } from "./notification.model";

const notificationCollectionName = "notifications";

export async function createMongoNotificationPersistenceStore(
  database: Db
): Promise<NotificationPersistenceStore> {
  const notificationCollection =
    database.collection<NotificationRecord>(notificationCollectionName);

  await Promise.all([
    notificationCollection.createIndex({ notificationId: 1 }, { unique: true }),
    notificationCollection.createIndex({ homeId: 1, createdAt: -1 })
  ]);

  return {
    notifications: {
      async get(notificationId) {
        return (await notificationCollection.findOne({ notificationId })) ?? undefined;
      },
      async listByHome(homeId) {
        return notificationCollection
          .find({ homeId })
          .sort({ createdAt: -1 })
          .toArray();
      },
      async save(record) {
        await notificationCollection.replaceOne(
          { notificationId: record.notificationId },
          record,
          { upsert: true }
        );

        return record;
      },
      async remove(notificationId) {
        await notificationCollection.deleteOne({ notificationId });
      },
      async reset() {
        await notificationCollection.deleteMany({});
      }
    }
  };
}
