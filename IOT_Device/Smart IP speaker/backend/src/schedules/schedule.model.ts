import type {
  SpeakerAnnouncementScheduleRecord,
  SpeakerScheduleExecutionRecord
} from "./schedule.types";

class SpeakerScheduleRepository {
  private readonly schedules = new Map<string, SpeakerAnnouncementScheduleRecord>();
  private readonly executions = new Map<string, SpeakerScheduleExecutionRecord>();
  private readonly executionKeys = new Set<string>();

  async listByHome(homeId: string): Promise<SpeakerAnnouncementScheduleRecord[]> {
    return [...this.schedules.values()]
      .filter((record) => record.homeId === homeId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((record) => structuredClone(record));
  }

  async getSchedule(
    scheduleId: string
  ): Promise<SpeakerAnnouncementScheduleRecord | null> {
    const record = this.schedules.get(scheduleId);
    return record ? structuredClone(record) : null;
  }

  async saveSchedule(
    record: SpeakerAnnouncementScheduleRecord
  ): Promise<SpeakerAnnouncementScheduleRecord> {
    this.schedules.set(record.scheduleId, structuredClone(record));
    return structuredClone(record);
  }

  async listExecutionsBySchedule(
    scheduleId: string
  ): Promise<SpeakerScheduleExecutionRecord[]> {
    return [...this.executions.values()]
      .filter((record) => record.scheduleId === scheduleId)
      .sort((left, right) => right.executedAt.localeCompare(left.executedAt))
      .map((record) => structuredClone(record));
  }

  async hasExecutionKey(scheduleId: string, executionKey: string): Promise<boolean> {
    return this.executionKeys.has(`${scheduleId}::${executionKey}`);
  }

  async saveExecution(
    record: SpeakerScheduleExecutionRecord
  ): Promise<SpeakerScheduleExecutionRecord> {
    this.executions.set(record.eventId, structuredClone(record));
    if (record.executionKey) {
      this.executionKeys.add(`${record.scheduleId}::${record.executionKey}`);
    }
    return structuredClone(record);
  }

  async reset(): Promise<void> {
    this.schedules.clear();
    this.executions.clear();
    this.executionKeys.clear();
  }
}

export const speakerScheduleRepository = new SpeakerScheduleRepository();
