import type { SpeakerGroupRecord } from "./group.types";

class SpeakerGroupRepository {
  private readonly records = new Map<string, SpeakerGroupRecord>();

  async listByHome(homeId: string): Promise<SpeakerGroupRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.homeId === homeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => structuredClone(record));
  }

  async get(groupId: string): Promise<SpeakerGroupRecord | null> {
    const record = this.records.get(groupId);
    return record ? structuredClone(record) : null;
  }

  async save(record: SpeakerGroupRecord): Promise<SpeakerGroupRecord> {
    this.records.set(record.groupId, structuredClone(record));
    return structuredClone(record);
  }

  async reset(): Promise<void> {
    this.records.clear();
  }
}

export const speakerGroupRepository = new SpeakerGroupRepository();
