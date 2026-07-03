import type { AuthProvider } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface AuthUserRecord {
  userId: string;
  email: string;
  name: string;
  provider: AuthProvider;
  passwordHash?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AuthRefreshSessionRecord {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface AuthUserRepository {
  getByUserId(userId: string): Promise<AuthUserRecord | undefined>;
  getByEmail(email: string): Promise<AuthUserRecord | undefined>;
  save(record: AuthUserRecord): Promise<AuthUserRecord>;
  reset(): Promise<void>;
}

export interface AuthRefreshSessionRepository {
  get(sessionId: string): Promise<AuthRefreshSessionRecord | undefined>;
  save(record: AuthRefreshSessionRecord): Promise<AuthRefreshSessionRecord>;
  reset(): Promise<void>;
}

export interface AuthPersistenceStore {
  users: AuthUserRepository;
  refreshSessions: AuthRefreshSessionRepository;
}

function createInMemoryAuthPersistenceStore(): AuthPersistenceStore {
  const userStore = new Map<string, AuthUserRecord>();
  const emailIndex = new Map<string, string>();
  const refreshSessionStore = new Map<string, AuthRefreshSessionRecord>();

  return {
    users: {
      async getByUserId(userId) {
        const record = userStore.get(userId);
        return record ? clone(record) : undefined;
      },
      async getByEmail(email) {
        const userId = emailIndex.get(email.trim().toLowerCase());

        if (!userId) {
          return undefined;
        }

        const record = userStore.get(userId);
        return record ? clone(record) : undefined;
      },
      async save(record) {
        const normalizedEmail = record.email.trim().toLowerCase();
        userStore.set(record.userId, clone({
          ...record,
          email: normalizedEmail
        }));
        emailIndex.set(normalizedEmail, record.userId);
        return clone({
          ...record,
          email: normalizedEmail
        });
      },
      async reset() {
        userStore.clear();
        emailIndex.clear();
      }
    },
    refreshSessions: {
      async get(sessionId) {
        const record = refreshSessionStore.get(sessionId);
        return record ? clone(record) : undefined;
      },
      async save(record) {
        refreshSessionStore.set(record.sessionId, clone(record));
        return clone(record);
      },
      async reset() {
        refreshSessionStore.clear();
      }
    }
  };
}

let activeAuthPersistenceStore = createInMemoryAuthPersistenceStore();

export function useAuthPersistenceStore(store: AuthPersistenceStore) {
  activeAuthPersistenceStore = store;
}

export function resetAuthPersistenceStore() {
  activeAuthPersistenceStore = createInMemoryAuthPersistenceStore();
}

export const authUserRepository: AuthUserRepository = {
  getByUserId(userId) {
    return activeAuthPersistenceStore.users.getByUserId(userId);
  },
  getByEmail(email) {
    return activeAuthPersistenceStore.users.getByEmail(email);
  },
  save(record) {
    return activeAuthPersistenceStore.users.save(record);
  },
  reset() {
    return activeAuthPersistenceStore.users.reset();
  }
};

export const authRefreshSessionRepository: AuthRefreshSessionRepository = {
  get(sessionId) {
    return activeAuthPersistenceStore.refreshSessions.get(sessionId);
  },
  save(record) {
    return activeAuthPersistenceStore.refreshSessions.save(record);
  },
  reset() {
    return activeAuthPersistenceStore.refreshSessions.reset();
  }
};
