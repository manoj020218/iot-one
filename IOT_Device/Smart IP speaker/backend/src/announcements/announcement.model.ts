import type {
  AnnouncementDispatchRecord,
  SpeakerRuntimeState
} from "./announcement.types";

const EMPTY_RUNTIME = {
  playbackState: "IDLE",
  volumePercent: null,
  muted: false,
  currentAnnouncementId: null,
  lastCommandType: null,
  lastProtocolCommandId: null,
  updatedAt: null
} as const;

class AnnouncementRepository {
  private readonly dispatchRecords = new Map<string, AnnouncementDispatchRecord>();
  private readonly runtimeRecords = new Map<string, SpeakerRuntimeState>();

  async listByHome(homeId: string): Promise<AnnouncementDispatchRecord[]> {
    return [...this.dispatchRecords.values()]
      .filter((record) => record.homeId === homeId)
      .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
      .map((record) => structuredClone(record));
  }

  async saveDispatch(
    record: AnnouncementDispatchRecord
  ): Promise<AnnouncementDispatchRecord> {
    this.dispatchRecords.set(record.announcementId, structuredClone(record));
    return structuredClone(record);
  }

  async getDeviceState(deviceId: string): Promise<SpeakerRuntimeState> {
    const record = this.runtimeRecords.get(deviceId);
    return structuredClone(
      record ?? {
        deviceId,
        ...EMPTY_RUNTIME
      }
    );
  }

  async saveDeviceState(state: SpeakerRuntimeState): Promise<SpeakerRuntimeState> {
    this.runtimeRecords.set(state.deviceId, structuredClone(state));
    return structuredClone(state);
  }

  async reset(): Promise<void> {
    this.dispatchRecords.clear();
    this.runtimeRecords.clear();
  }
}

export const announcementRepository = new AnnouncementRepository();
