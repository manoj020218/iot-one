import { randomUUID } from "node:crypto";

import type { QrunlockActivityEvent, QrunlockActivityType } from "./activity.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

// Newest-first, capped per device — this is a live activity feed, not a
// durable audit log. Swap for real persistence (with real pagination) if
// QRunlock ever needs history beyond what fits on one screen.
const MAX_EVENTS_PER_DEVICE = 50;

export interface ActivityRepository {
  record(deviceId: string, type: QrunlockActivityType, source: string, detail?: string): Promise<QrunlockActivityEvent>;
  list(deviceId: string): Promise<QrunlockActivityEvent[]>;
  reset(): Promise<void>;
}

function createInMemoryActivityRepository(): ActivityRepository {
  const store = new Map<string, QrunlockActivityEvent[]>();

  return {
    async record(deviceId, type, source, detail) {
      const event: QrunlockActivityEvent = {
        eventId: randomUUID(),
        deviceId,
        type,
        source,
        occurredAt: new Date().toISOString(),
        ...(detail ? { detail } : {})
      };
      const existing = store.get(deviceId) ?? [];
      const next = [event, ...existing].slice(0, MAX_EVENTS_PER_DEVICE);
      store.set(deviceId, next);
      return clone(event);
    },
    async list(deviceId) {
      return clone(store.get(deviceId) ?? []);
    },
    async reset() {
      store.clear();
    }
  };
}

export const activityRepository: ActivityRepository = createInMemoryActivityRepository();

export async function resetActivityStore(): Promise<void> {
  await activityRepository.reset();
}
