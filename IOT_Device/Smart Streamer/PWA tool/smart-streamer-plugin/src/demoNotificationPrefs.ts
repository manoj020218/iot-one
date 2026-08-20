/**
 * Per-user notification preferences for Smart Streamer events — the
 * exact event list from Streamer Plugin.txt §16. This uses the platform's
 * existing notification framework once it exists (see
 * SMART_STREAMER_PLATFORM_ADDITIONS.md item 3); until then these are
 * local demo toggles, not wired to anything.
 */
export interface NotificationPref {
  eventId: string;
  label: string;
  enabled: boolean;
}

export const DEMO_NOTIFICATION_PREFS: NotificationPref[] = [
  { eventId: "stream_started", label: "Stream started", enabled: true },
  { eventId: "stream_stopped", label: "Stream stopped", enabled: true },
  { eventId: "stream_failed", label: "Stream failed", enabled: true },
  { eventId: "camera_disconnected", label: "Camera disconnected", enabled: true },
  { eventId: "destination_rejected", label: "Destination rejected stream", enabled: true },
  { eventId: "credential_expired", label: "Destination credential expired", enabled: true },
  { eventId: "schedule_missed", label: "Schedule missed", enabled: true },
  { eventId: "device_offline", label: "Device offline", enabled: true },
  { eventId: "device_online", label: "Device back online", enabled: false },
  { eventId: "repeated_reboot", label: "Repeated reboot", enabled: true },
  { eventId: "low_memory", label: "Low-memory warning", enabled: false },
  { eventId: "ota_succeeded", label: "OTA succeeded", enabled: false },
  { eventId: "ota_failed", label: "OTA failed", enabled: true }
];
