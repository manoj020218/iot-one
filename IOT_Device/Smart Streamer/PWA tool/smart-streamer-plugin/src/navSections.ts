export interface StreamerSection {
  id: string;
  label: string;
}

// Order matches Streamer Plugin.txt §5's primary navigation.
export const STREAMER_SECTIONS: StreamerSection[] = [
  { id: "overview", label: "Overview" },
  { id: "devices", label: "Devices" },
  { id: "cameras", label: "Cameras" },
  { id: "destinations", label: "Destinations" },
  { id: "schedules", label: "Schedules" },
  { id: "sessions", label: "Live Sessions" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "ota", label: "OTA" },
  { id: "settings", label: "Device Settings" }
];
