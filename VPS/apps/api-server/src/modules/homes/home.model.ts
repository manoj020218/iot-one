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

const homeStore = new Map<string, StoredHomeRecord>();
const homeMemberStore = new Map<string, HomeMemberRecord[]>();
const homeShareCodeStore = new Map<string, HomeShareCodeRecord[]>();
const homeUserProfileStore = new Map<string, HomeUserProfile>();
const homeAuditStore = new Map<string, HomeAuditEntry[]>();

export const homeRepository = {
  get(homeId: string) {
    const record = homeStore.get(homeId);
    return record ? clone(record) : undefined;
  },
  list() {
    return Array.from(homeStore.values()).map(clone);
  },
  save(record: StoredHomeRecord) {
    homeStore.set(record.homeId, clone(record));
    return clone(record);
  },
  reset() {
    homeStore.clear();
  }
};

export const homeMemberRepository = {
  listByHome(homeId: string) {
    return clone(homeMemberStore.get(homeId) ?? []);
  },
  listByUser(userId: string) {
    return Array.from(homeMemberStore.values())
      .flatMap((members) => members.filter((member) => member.userId === userId))
      .map(clone);
  },
  find(homeId: string, userId: string) {
    return this.listByHome(homeId).find((member) => member.userId === userId);
  },
  save(record: HomeMemberRecord) {
    const members = this.listByHome(record.homeId);
    const nextMembers = members.some((member) => member.membershipId === record.membershipId)
      ? members.map((member) =>
          member.membershipId === record.membershipId ? clone(record) : member
        )
      : [...members, clone(record)];

    homeMemberStore.set(record.homeId, nextMembers);
    return clone(record);
  },
  remove(homeId: string, membershipId: string) {
    const nextMembers = this.listByHome(homeId).filter(
      (member) => member.membershipId !== membershipId
    );
    homeMemberStore.set(homeId, nextMembers);
  },
  reset() {
    homeMemberStore.clear();
  }
};

export const homeShareCodeRepository = {
  listByHome(homeId: string) {
    return clone(homeShareCodeStore.get(homeId) ?? []);
  },
  getByCode(code: string) {
    return Array.from(homeShareCodeStore.values())
      .flatMap((shareCodes) => shareCodes)
      .find((shareCode) => shareCode.code === code.trim().toUpperCase());
  },
  save(record: HomeShareCodeRecord) {
    const shareCodes = this.listByHome(record.homeId);
    const nextShareCodes = shareCodes.some(
      (shareCode) => shareCode.shareCodeId === record.shareCodeId
    )
      ? shareCodes.map((shareCode) =>
          shareCode.shareCodeId === record.shareCodeId ? clone(record) : shareCode
        )
      : [...shareCodes, clone(record)];

    homeShareCodeStore.set(record.homeId, nextShareCodes);
    return clone(record);
  },
  reset() {
    homeShareCodeStore.clear();
  }
};

export const homeUserProfileRepository = {
  get(userId: string) {
    const record = homeUserProfileStore.get(userId);
    return record ? clone(record) : undefined;
  },
  save(record: HomeUserProfile) {
    homeUserProfileStore.set(record.userId, clone(record));
    return clone(record);
  },
  reset() {
    homeUserProfileStore.clear();
  }
};

export const homeAuditRepository = {
  listByHome(homeId: string) {
    return clone(homeAuditStore.get(homeId) ?? []);
  },
  append(record: HomeAuditEntry) {
    const entries = this.listByHome(record.homeId);
    homeAuditStore.set(record.homeId, [...entries, clone(record)]);
  },
  reset() {
    homeAuditStore.clear();
  }
};
