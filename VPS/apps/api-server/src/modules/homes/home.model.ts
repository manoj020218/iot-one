import type {
  HomeMemberRecord,
  HomeShareCodeRecord
} from "@jenix/shared";

import type {
  HomeAuditEntry,
  HomeUserProfile,
  StoredHomeRecord
} from "./home.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface HomeRepository {
  get(homeId: string): Promise<StoredHomeRecord | undefined>;
  list(): Promise<StoredHomeRecord[]>;
  findDefaultByOwner(ownerUserId: string): Promise<StoredHomeRecord | undefined>;
  save(record: StoredHomeRecord): Promise<StoredHomeRecord>;
  remove(homeId: string): Promise<void>;
  reset(): Promise<void>;
}

export interface HomeMemberRepository {
  listByHome(homeId: string): Promise<HomeMemberRecord[]>;
  listByUser(userId: string): Promise<HomeMemberRecord[]>;
  find(homeId: string, userId: string): Promise<HomeMemberRecord | undefined>;
  save(record: HomeMemberRecord): Promise<HomeMemberRecord>;
  remove(homeId: string, membershipId: string): Promise<void>;
  removeByHome(homeId: string): Promise<void>;
  reset(): Promise<void>;
}

export interface HomeShareCodeRepository {
  listByHome(homeId: string): Promise<HomeShareCodeRecord[]>;
  getByCode(code: string): Promise<HomeShareCodeRecord | undefined>;
  save(record: HomeShareCodeRecord): Promise<HomeShareCodeRecord>;
  removeByHome(homeId: string): Promise<void>;
  reset(): Promise<void>;
}

export interface HomeUserProfileRepository {
  get(userId: string): Promise<HomeUserProfile | undefined>;
  save(record: HomeUserProfile): Promise<HomeUserProfile>;
  reset(): Promise<void>;
}

export interface HomeAuditRepository {
  listByHome(homeId: string): Promise<HomeAuditEntry[]>;
  append(record: HomeAuditEntry): Promise<void>;
  removeByHome(homeId: string): Promise<void>;
  reset(): Promise<void>;
}

export interface HomePersistenceStore {
  homes: HomeRepository;
  members: HomeMemberRepository;
  shareCodes: HomeShareCodeRepository;
  userProfiles: HomeUserProfileRepository;
  audits: HomeAuditRepository;
}

function createInMemoryHomePersistenceStore(): HomePersistenceStore {
  const homeStore = new Map<string, StoredHomeRecord>();
  const homeMemberStore = new Map<string, HomeMemberRecord[]>();
  const homeShareCodeStore = new Map<string, HomeShareCodeRecord[]>();
  const homeUserProfileStore = new Map<string, HomeUserProfile>();
  const homeAuditStore = new Map<string, HomeAuditEntry[]>();

  const homes: HomeRepository = {
    async get(homeId) {
      const record = homeStore.get(homeId);
      return record ? clone(record) : undefined;
    },
    async list() {
      return Array.from(homeStore.values()).map(clone);
    },
    async findDefaultByOwner(ownerUserId) {
      const record = Array.from(homeStore.values()).find(
        (home) => home.ownerUserId === ownerUserId && home.isDefault
      );
      return record ? clone(record) : undefined;
    },
    async save(record) {
      homeStore.set(record.homeId, clone(record));
      return clone(record);
    },
    async remove(homeId) {
      homeStore.delete(homeId);
    },
    async reset() {
      homeStore.clear();
    }
  };

  const members: HomeMemberRepository = {
    async listByHome(homeId) {
      return clone(homeMemberStore.get(homeId) ?? []);
    },
    async listByUser(userId) {
      return Array.from(homeMemberStore.values())
        .flatMap((records) => records.filter((record) => record.userId === userId))
        .map(clone);
    },
    async find(homeId, userId) {
      return (await members.listByHome(homeId)).find((member) => member.userId === userId);
    },
    async save(record) {
      const existingMembers = await members.listByHome(record.homeId);
      const nextMembers = existingMembers.some(
        (member) => member.membershipId === record.membershipId
      )
        ? existingMembers.map((member) =>
            member.membershipId === record.membershipId ? clone(record) : member
          )
        : [...existingMembers, clone(record)];

      homeMemberStore.set(record.homeId, nextMembers);
      return clone(record);
    },
    async remove(homeId, membershipId) {
      const nextMembers = (await members.listByHome(homeId)).filter(
        (member) => member.membershipId !== membershipId
      );
      homeMemberStore.set(homeId, nextMembers);
    },
    async removeByHome(homeId) {
      homeMemberStore.delete(homeId);
    },
    async reset() {
      homeMemberStore.clear();
    }
  };

  const shareCodes: HomeShareCodeRepository = {
    async listByHome(homeId) {
      return clone(homeShareCodeStore.get(homeId) ?? []);
    },
    async getByCode(code) {
      return Array.from(homeShareCodeStore.values())
        .flatMap((records) => records)
        .find((record) => record.code === code.trim().toUpperCase());
    },
    async save(record) {
      const existingShareCodes = await shareCodes.listByHome(record.homeId);
      const nextShareCodes = existingShareCodes.some(
        (shareCode) => shareCode.shareCodeId === record.shareCodeId
      )
        ? existingShareCodes.map((shareCode) =>
            shareCode.shareCodeId === record.shareCodeId ? clone(record) : shareCode
          )
        : [...existingShareCodes, clone(record)];

      homeShareCodeStore.set(record.homeId, nextShareCodes);
      return clone(record);
    },
    async removeByHome(homeId) {
      homeShareCodeStore.delete(homeId);
    },
    async reset() {
      homeShareCodeStore.clear();
    }
  };

  const userProfiles: HomeUserProfileRepository = {
    async get(userId) {
      const record = homeUserProfileStore.get(userId);
      return record ? clone(record) : undefined;
    },
    async save(record) {
      homeUserProfileStore.set(record.userId, clone(record));
      return clone(record);
    },
    async reset() {
      homeUserProfileStore.clear();
    }
  };

  const audits: HomeAuditRepository = {
    async listByHome(homeId) {
      return clone(homeAuditStore.get(homeId) ?? []);
    },
    async append(record) {
      const existingEntries = await audits.listByHome(record.homeId);
      homeAuditStore.set(record.homeId, [...existingEntries, clone(record)]);
    },
    async removeByHome(homeId) {
      homeAuditStore.delete(homeId);
    },
    async reset() {
      homeAuditStore.clear();
    }
  };

  return {
    homes,
    members,
    shareCodes,
    userProfiles,
    audits
  };
}

let activeHomePersistenceStore = createInMemoryHomePersistenceStore();

export function useHomePersistenceStore(store: HomePersistenceStore) {
  activeHomePersistenceStore = store;
}

export function resetHomePersistenceStore() {
  activeHomePersistenceStore = createInMemoryHomePersistenceStore();
}

export const homeRepository: HomeRepository = {
  get(homeId) {
    return activeHomePersistenceStore.homes.get(homeId);
  },
  list() {
    return activeHomePersistenceStore.homes.list();
  },
  findDefaultByOwner(ownerUserId) {
    return activeHomePersistenceStore.homes.findDefaultByOwner(ownerUserId);
  },
  save(record) {
    return activeHomePersistenceStore.homes.save(record);
  },
  remove(homeId) {
    return activeHomePersistenceStore.homes.remove(homeId);
  },
  reset() {
    return activeHomePersistenceStore.homes.reset();
  }
};

export const homeMemberRepository: HomeMemberRepository = {
  listByHome(homeId) {
    return activeHomePersistenceStore.members.listByHome(homeId);
  },
  listByUser(userId) {
    return activeHomePersistenceStore.members.listByUser(userId);
  },
  find(homeId, userId) {
    return activeHomePersistenceStore.members.find(homeId, userId);
  },
  save(record) {
    return activeHomePersistenceStore.members.save(record);
  },
  remove(homeId, membershipId) {
    return activeHomePersistenceStore.members.remove(homeId, membershipId);
  },
  removeByHome(homeId) {
    return activeHomePersistenceStore.members.removeByHome(homeId);
  },
  reset() {
    return activeHomePersistenceStore.members.reset();
  }
};

export const homeShareCodeRepository: HomeShareCodeRepository = {
  listByHome(homeId) {
    return activeHomePersistenceStore.shareCodes.listByHome(homeId);
  },
  getByCode(code) {
    return activeHomePersistenceStore.shareCodes.getByCode(code);
  },
  save(record) {
    return activeHomePersistenceStore.shareCodes.save(record);
  },
  removeByHome(homeId) {
    return activeHomePersistenceStore.shareCodes.removeByHome(homeId);
  },
  reset() {
    return activeHomePersistenceStore.shareCodes.reset();
  }
};

export const homeUserProfileRepository: HomeUserProfileRepository = {
  get(userId) {
    return activeHomePersistenceStore.userProfiles.get(userId);
  },
  save(record) {
    return activeHomePersistenceStore.userProfiles.save(record);
  },
  reset() {
    return activeHomePersistenceStore.userProfiles.reset();
  }
};

export const homeAuditRepository: HomeAuditRepository = {
  listByHome(homeId) {
    return activeHomePersistenceStore.audits.listByHome(homeId);
  },
  append(record) {
    return activeHomePersistenceStore.audits.append(record);
  },
  removeByHome(homeId) {
    return activeHomePersistenceStore.audits.removeByHome(homeId);
  },
  reset() {
    return activeHomePersistenceStore.audits.reset();
  }
};
