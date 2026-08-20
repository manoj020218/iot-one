/**
 * Shaped like GET /api/v1/streamer/schedules in VPS/API_CONTRACT.md §4.
 * This is the PWA-facing shape only — a single start/stop window. The
 * VPS implements each of these as a pair of linked Scene records
 * internally; this plugin never needs to know that.
 */
export interface StreamerScheduleSummary {
  scheduleId: string;
  name: string;
  deviceId: string;
  cameraId: string;
  destinationId: string;
  timezone: string;
  startLocalTime: string;
  stopLocalTime: string;
  daysOfWeek: string[];
  enabled: boolean;
  priority: number;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DEMO_STREAMER_SCHEDULES: StreamerScheduleSummary[] = [
  {
    scheduleId: "SCH-0001",
    name: "Evening Aarti",
    deviceId: "JNX-P4-000102",
    cameraId: "CAM-0002",
    destinationId: "DEST-00011",
    timezone: "Asia/Kolkata",
    startLocalTime: "18:00",
    stopLocalTime: "19:00",
    daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    enabled: true,
    priority: 1
  },
  {
    scheduleId: "SCH-0002",
    name: "Sunday Pooja",
    deviceId: "JNX-P4-000101",
    cameraId: "CAM-0001",
    destinationId: "DEST-00017",
    timezone: "Asia/Kolkata",
    startLocalTime: "09:00",
    stopLocalTime: "10:30",
    daysOfWeek: ["Sun"],
    enabled: true,
    priority: 2
  }
];
