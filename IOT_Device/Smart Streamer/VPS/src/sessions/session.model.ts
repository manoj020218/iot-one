import { ACTIVE_SESSION_STATUSES } from "./session.types";
import type { StreamerSessionSummary } from "./session.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface SessionRepository {
  get(sessionId: string): Promise<StreamerSessionSummary | undefined>;
  save(record: StreamerSessionSummary): Promise<StreamerSessionSummary>;
  findActiveByDevice(deviceId: string): Promise<StreamerSessionSummary | undefined>;
  findActiveByDestination(destinationId: string): Promise<StreamerSessionSummary | undefined>;
  // requestId -> sessionId, for idempotent retries (VPS/API_CONTRACT.md §5).
  getByRequestId(requestId: string): Promise<string | undefined>;
  saveRequestId(requestId: string, sessionId: string): Promise<void>;
  reset(): Promise<void>;
}

function createInMemorySessionRepository(): SessionRepository {
  const store = new Map<string, StreamerSessionSummary>();
  const requestIndex = new Map<string, string>();

  return {
    async get(sessionId) {
      const record = store.get(sessionId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      store.set(record.sessionId, clone(record));
      return clone(record);
    },
    async findActiveByDevice(deviceId) {
      const match = Array.from(store.values()).find(
        (session) => session.deviceId === deviceId && ACTIVE_SESSION_STATUSES.has(session.status)
      );
      return match ? clone(match) : undefined;
    },
    async findActiveByDestination(destinationId) {
      const match = Array.from(store.values()).find(
        (session) =>
          session.destinationId === destinationId && ACTIVE_SESSION_STATUSES.has(session.status)
      );
      return match ? clone(match) : undefined;
    },
    async getByRequestId(requestId) {
      return requestIndex.get(requestId);
    },
    async saveRequestId(requestId, sessionId) {
      requestIndex.set(requestId, sessionId);
    },
    async reset() {
      store.clear();
      requestIndex.clear();
    }
  };
}

export const sessionRepository: SessionRepository = createInMemorySessionRepository();

export async function resetSessionStore(): Promise<void> {
  await sessionRepository.reset();
}
