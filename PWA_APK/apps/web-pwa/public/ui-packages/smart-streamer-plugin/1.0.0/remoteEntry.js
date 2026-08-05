"use strict";
(() => {
  // src/host.ts
  function requireHost() {
    const found = window.__JENIX_DEVICE_PACKAGE_HOST__;
    if (!found || !found.React || typeof found.registerPackage !== "function") {
      throw new Error("Jenix device package host is not available");
    }
    return found;
  }
  var host = requireHost();
  var React = host.React;

  // src/navSections.ts
  var STREAMER_SECTIONS = [
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

  // src/components/SectionTabs.tsx
  function SectionTabs({ active, onSelect }) {
    return /* @__PURE__ */ React.createElement("nav", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 } }, STREAMER_SECTIONS.map((section) => /* @__PURE__ */ React.createElement(
      "button",
      {
        className: section.id === active ? "primary-button" : "secondary-button",
        key: section.id,
        onClick: () => onSelect(section.id),
        type: "button"
      },
      section.label
    )));
  }

  // src/demoDevices.ts
  var DEMO_STREAMER_DEVICES = [
    {
      deviceId: "JNX-P4-000101",
      friendlyName: "Front Gate Camera",
      onlineStatus: "online",
      streamState: "IDLE",
      assignedCameraId: "CAM-0001",
      activeSessionId: null,
      activeDestinationPlatform: null,
      nextScheduleAt: "2026-08-04T18:00:00+05:30",
      wifiRssi: -58,
      firmwareVersion: "1.0.0",
      lastSeenAt: "2026-08-04T10:02:11Z"
    },
    {
      deviceId: "JNX-P4-000102",
      friendlyName: "Prayer Hall Camera",
      onlineStatus: "online",
      streamState: "STREAMING",
      assignedCameraId: "CAM-0002",
      activeSessionId: "SES-20260804-0012",
      activeDestinationPlatform: "youtube",
      nextScheduleAt: null,
      wifiRssi: -61,
      firmwareVersion: "1.0.0",
      lastSeenAt: "2026-08-04T11:15:40Z"
    }
  ];

  // src/demoDestinations.ts
  var PLATFORM_LABELS = {
    youtube: "YouTube",
    facebook: "Facebook",
    instagram: "Instagram"
  };
  var DEMO_STREAMER_DESTINATIONS = [
    {
      destinationId: "DEST-00011",
      platform: "youtube",
      displayName: "Main Channel \u2014 YouTube",
      credentialMode: "persistent",
      hasStreamKey: true,
      credentialExpiry: null,
      lastValidatedAt: "2026-08-01T09:00:00Z",
      enabled: true
    },
    {
      destinationId: "DEST-00017",
      platform: "instagram",
      displayName: "Temple Live \u2014 IG",
      credentialMode: "temporary",
      hasStreamKey: true,
      credentialExpiry: "2026-08-04T20:00:00Z",
      lastValidatedAt: "2026-08-04T09:00:00Z",
      enabled: true
    }
  ];

  // src/demoSchedules.ts
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var DEMO_STREAMER_SCHEDULES = [
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

  // src/demoSessions.ts
  var DEMO_STREAMER_SESSIONS = [
    {
      sessionId: "SES-20260804-0012",
      deviceId: "JNX-P4-000102",
      cameraId: "CAM-0002",
      destinationId: "DEST-00011",
      platform: "youtube",
      status: "STREAMING",
      triggerSource: "schedule",
      videoMode: "h264_passthrough",
      audioMode: "aac_passthrough",
      connectionStatus: "connected",
      reconnectCount: 0,
      currentBitrateKbps: 4200,
      startTime: "2026-08-04T12:30:00Z",
      plannedStopAt: "2026-08-04T13:30:00Z",
      stoppedAt: null
    },
    {
      sessionId: "SES-20260803-0007",
      deviceId: "JNX-P4-000101",
      cameraId: "CAM-0001",
      destinationId: "DEST-00017",
      platform: "instagram",
      status: "STOPPED",
      triggerSource: "manual",
      videoMode: "h264_passthrough",
      audioMode: "aac_passthrough",
      connectionStatus: "disconnected",
      reconnectCount: 1,
      currentBitrateKbps: null,
      startTime: "2026-08-03T09:00:00Z",
      plannedStopAt: null,
      stoppedAt: "2026-08-03T10:32:00Z"
    }
  ];

  // src/demoDiagnostics.ts
  var DEMO_DEVICE_HEALTH = [
    {
      deviceId: "JNX-P4-000101",
      onlineStatus: "online",
      lastSeenAt: "2026-08-04T10:02:11Z",
      uptimeSeconds: 86200,
      resetReason: "power_on",
      freeHeap: 183e3,
      minFreeHeap: 151e3,
      largestFreeBlock: 92e3,
      psramStatus: "ok, 6.1 MB free",
      wifiRssi: -58,
      ipAddress: "192.168.1.101",
      timeSynchronized: true,
      cameraConnection: "disconnected",
      rtspState: "IDLE",
      rtmpState: "IDLE",
      currentSessionId: null,
      reconnectCount: 3,
      lastError: "CAMERA_AUTH_FAILED",
      firmwareVersion: "1.0.0",
      hardwareRevision: "P4-EVB-A"
    },
    {
      deviceId: "JNX-P4-000102",
      onlineStatus: "online",
      lastSeenAt: "2026-08-04T11:15:40Z",
      uptimeSeconds: 41200,
      resetReason: "power_on",
      freeHeap: 176500,
      minFreeHeap: 148200,
      largestFreeBlock: 88e3,
      psramStatus: "ok, 5.8 MB free",
      wifiRssi: -61,
      ipAddress: "192.168.1.102",
      timeSynchronized: true,
      cameraConnection: "connected",
      rtspState: "STREAMING",
      rtmpState: "PUBLISHING",
      currentSessionId: "SES-20260804-0012",
      reconnectCount: 0,
      lastError: null,
      firmwareVersion: "1.0.0",
      hardwareRevision: "P4-EVB-A"
    }
  ];

  // src/utils/formatDuration.ts
  function formatDuration(startIso, endIso) {
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    const minutes = Math.max(0, Math.round((end - start) / 6e4));
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours > 0 ? `${hours}h ${remaining}m` : `${remaining}m`;
  }

  // src/pages/OverviewPage.tsx
  var LATEST_FIRMWARE_VERSION = "1.1.0";
  function isExpired(iso) {
    return iso !== null && new Date(iso).getTime() < Date.now();
  }
  function todayAbbreviation() {
    var _a;
    const index = ((/* @__PURE__ */ new Date()).getDay() + 6) % 7;
    return (_a = WEEKDAYS[index]) != null ? _a : "Mon";
  }
  function primaryActionFor(device) {
    const health = DEMO_DEVICE_HEALTH.find((entry) => entry.deviceId === device.deviceId);
    if (device.onlineStatus === "offline") return { label: "Diagnose", section: "diagnostics" };
    if (health == null ? void 0 : health.lastError) return { label: "Diagnose", section: "diagnostics" };
    if (device.streamState === "STREAMING") return { label: "View / Stop", section: "sessions" };
    const destination = device.activeDestinationPlatform ? DEMO_STREAMER_DESTINATIONS.find((entry) => entry.platform === device.activeDestinationPlatform) : void 0;
    if (destination && isExpired(destination.credentialExpiry)) {
      return { label: "Update Destination", section: "destinations" };
    }
    if (device.firmwareVersion !== LATEST_FIRMWARE_VERSION) return { label: "Review OTA", section: "ota" };
    return { label: "Start Stream", section: "devices" };
  }
  function StatTile({ value, label }) {
    return /* @__PURE__ */ React.createElement("article", { className: "panel", style: { padding: "12px 14px" } }, /* @__PURE__ */ React.createElement("p", { style: { margin: 0, fontSize: 24, fontWeight: 700 } }, value), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { margin: 0 } }, label));
  }
  function OverviewPage({ onNavigate }) {
    const today = todayAbbreviation();
    const total = DEMO_STREAMER_DEVICES.length;
    const online = DEMO_STREAMER_DEVICES.filter((d) => d.onlineStatus === "online").length;
    const streamingNow = DEMO_STREAMER_DEVICES.filter((d) => d.streamState === "STREAMING").length;
    const scheduledToday = DEMO_STREAMER_SCHEDULES.filter((s) => s.daysOfWeek.includes(today)).length;
    const needsAttention = DEMO_DEVICE_HEALTH.filter((h) => h.lastError !== null).length;
    const expiredCredentials = DEMO_STREAMER_DESTINATIONS.filter((d) => isExpired(d.credentialExpiry)).length;
    const firmwareUpdates = DEMO_STREAMER_DEVICES.filter((d) => d.firmwareVersion !== LATEST_FIRMWARE_VERSION).length;
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginBottom: 16 } }, "Demo data \u2014 computed from the same fixtures every other section uses. Real numbers arrive once the VPS module ships (Streamer Plugin.txt \xA76)."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", marginBottom: 20 } }, /* @__PURE__ */ React.createElement(StatTile, { label: "Total Devices", value: total }), /* @__PURE__ */ React.createElement(StatTile, { label: "Online", value: online }), /* @__PURE__ */ React.createElement(StatTile, { label: "Offline", value: total - online }), /* @__PURE__ */ React.createElement(StatTile, { label: "Streaming Now", value: streamingNow }), /* @__PURE__ */ React.createElement(StatTile, { label: "Scheduled Today", value: scheduledToday }), /* @__PURE__ */ React.createElement(StatTile, { label: "Needs Attention", value: needsAttention }), /* @__PURE__ */ React.createElement(StatTile, { label: "Expired Credentials", value: expiredCredentials }), /* @__PURE__ */ React.createElement(StatTile, { label: "Firmware Updates", value: firmwareUpdates })), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_DEVICES.map((device) => {
      var _a, _b;
      const session = device.activeSessionId ? DEMO_STREAMER_SESSIONS.find((entry) => entry.sessionId === device.activeSessionId) : void 0;
      const action = primaryActionFor(device);
      return /* @__PURE__ */ React.createElement("article", { className: "device-card", key: device.deviceId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, device.streamState === "STREAMING" ? "\u25CF" : "\u25CB"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, device.streamState === "STREAMING" ? "Live" : device.onlineStatus === "online" ? "Idle" : "Offline"), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, device.deviceId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, device.friendlyName), /* @__PURE__ */ React.createElement("p", null, device.activeDestinationPlatform ? PLATFORM_LABELS[device.activeDestinationPlatform] : "No destination active")), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Camera"), /* @__PURE__ */ React.createElement("dd", null, (_a = device.assignedCameraId) != null ? _a : "None")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Session Duration"), /* @__PURE__ */ React.createElement("dd", null, session ? formatDuration(session.startTime, session.stoppedAt) : "\u2014")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Next Schedule"), /* @__PURE__ */ React.createElement("dd", null, (_b = device.nextScheduleAt) != null ? _b : "None")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "WiFi RSSI"), /* @__PURE__ */ React.createElement("dd", null, device.wifiRssi, " dBm")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Firmware"), /* @__PURE__ */ React.createElement("dd", null, device.firmwareVersion)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Last Seen"), /* @__PURE__ */ React.createElement("dd", null, device.lastSeenAt))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, device.onlineStatus === "online" ? "Online" : "Offline"), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onNavigate(action.section), type: "button" }, action.label)));
    })));
  }

  // src/pages/DevicesPage.tsx
  function DevicesPage({ onOpenDevice }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginBottom: 16 } }, "Demo data \u2014 replace with GET /api/v1/streamer/devices once the VPS module ships (see VPS/API_CONTRACT.md \xA71)."), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_DEVICES.map((device) => /* @__PURE__ */ React.createElement("article", { className: "device-card", key: device.deviceId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, "SS"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, "Smart Streamer"), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, device.deviceId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, device.friendlyName), /* @__PURE__ */ React.createElement("p", null, device.streamState)), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, device.onlineStatus === "online" ? "Online" : "Offline"), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenDevice(device.deviceId), type: "button" }, "Open Details"))))));
  }

  // src/components/DetailSection.tsx
  function DetailSection({ title, note }) {
    return /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, title))), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, note));
  }

  // src/pages/DeviceDetailPage.tsx
  var DISABLED_ACTIONS = [
    "Start Stream",
    "Stop Stream",
    "Restart Pipeline",
    "Test Camera",
    "Open Diagnostics"
  ];
  function DeviceDetailPage({ deviceId, onBack }) {
    var _a, _b;
    const device = DEMO_STREAMER_DEVICES.find((entry) => entry.deviceId === deviceId);
    if (!device) {
      return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton, { onBack }), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Device not found.")));
    }
    const streamNote = device.activeSessionId ? `Session ${device.activeSessionId} live on ${device.activeDestinationPlatform}.` : "No active session.";
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton, { onBack }), /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Device Summary"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, device.friendlyName), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, device.deviceId, " \xB7 Firmware ", device.firmwareVersion))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Status"), /* @__PURE__ */ React.createElement("dd", null, device.onlineStatus)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Stream State"), /* @__PURE__ */ React.createElement("dd", null, device.streamState)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "WiFi RSSI"), /* @__PURE__ */ React.createElement("dd", null, device.wifiRssi, " dBm")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Last Seen"), /* @__PURE__ */ React.createElement("dd", null, device.lastSeenAt)))), /* @__PURE__ */ React.createElement(DetailSection, { note: streamNote, title: "Current Stream" }), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: (_a = device.assignedCameraId) != null ? _a : "No camera assigned yet.",
        title: "Assigned Camera"
      }
    ), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: "YouTube, Facebook, and Instagram profiles assignable once Destinations ships.",
        title: "Available Destinations"
      }
    ), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: (_b = device.nextScheduleAt) != null ? _b : "No upcoming schedule.",
        title: "Next Schedule"
      }
    ), /* @__PURE__ */ React.createElement(DetailSection, { note: `RSSI ${device.wifiRssi} dBm.`, title: "Network Status" }), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: "Free heap, reconnect count, RTSP/RTMP state land with the Diagnostics API.",
        title: "Health"
      }
    ), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: "Claim, camera/destination changes, and stream events land with the platform audit log.",
        title: "Recent Activity"
      }
    ), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Actions"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "Device Actions"))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, DISABLED_ACTIONS.map((label) => /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, key: label, type: "button" }, label))), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 8 } }, "Wired to POST /api/v1/devices/:deviceId/streamer/... once the VPS module ships (see VPS/API_CONTRACT.md \xA71 and \xA75).")));
  }
  function BackButton({ onBack }) {
    return /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Devices");
  }

  // src/demoCameras.ts
  var DEMO_STREAMER_CAMERAS = [
    {
      cameraId: "CAM-0001",
      friendlyName: "Front Gate",
      rtspHost: "192.168.1.40",
      rtspPort: 554,
      rtspPath: "/stream1",
      videoCodec: "H.264",
      audioCodec: "AAC",
      rotation: 0,
      transport: "tcp",
      assignedDeviceId: "JNX-P4-000101"
    },
    {
      cameraId: "CAM-0002",
      friendlyName: "Prayer Hall",
      rtspHost: "192.168.1.41",
      rtspPort: 554,
      rtspPath: "/stream1",
      videoCodec: "H.264",
      audioCodec: "AAC",
      rotation: 0,
      transport: "tcp",
      assignedDeviceId: "JNX-P4-000102"
    }
  ];

  // src/pages/CamerasPage.tsx
  function CamerasPage({ onOpenCamera, onAddCamera }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Demo data \u2014 replace with GET /api/v1/streamer/cameras once the VPS module ships (see VPS/API_CONTRACT.md \xA72).")), /* @__PURE__ */ React.createElement("button", { className: "primary-button", onClick: onAddCamera, type: "button" }, "Add Camera")), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_CAMERAS.map((camera) => {
      var _a;
      return /* @__PURE__ */ React.createElement("article", { className: "device-card", key: camera.cameraId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, "CAM"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, camera.videoCodec, " / ", camera.audioCodec), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, camera.cameraId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, camera.friendlyName), /* @__PURE__ */ React.createElement("p", null, "rtsp://", camera.rtspHost, ":", camera.rtspPort, camera.rtspPath)), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Transport"), /* @__PURE__ */ React.createElement("dd", null, camera.transport.toUpperCase())), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Assigned Device"), /* @__PURE__ */ React.createElement("dd", null, (_a = camera.assignedDeviceId) != null ? _a : "Unassigned"))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenCamera(camera.cameraId), type: "button" }, "Edit & Test")));
    })));
  }

  // src/components/CameraTestSteps.tsx
  var INITIAL_TEST_STEPS = [
    { id: "reachable", label: "Camera reachable", status: "pending" },
    { id: "rtsp_auth", label: "RTSP authentication successful", status: "pending" },
    { id: "video_codec", label: "H.264 video detected", status: "pending" },
    { id: "audio_codec", label: "AAC audio detected", status: "pending" },
    { id: "keyframe", label: "Keyframe received", status: "pending" },
    { id: "passthrough_compatible", label: "Compatible with passthrough mode", status: "pending" }
  ];
  function statusMark(status) {
    if (status === "passed") return "\u2713";
    if (status === "failed") return "\u2717";
    if (status === "in_progress") return "\u2026";
    return "\u25CB";
  }
  function CameraTestSteps({ steps }) {
    return /* @__PURE__ */ React.createElement("ol", { style: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 } }, steps.map((step) => /* @__PURE__ */ React.createElement("li", { key: step.id, style: { display: "flex", gap: 10, alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": true, style: { width: 18, textAlign: "center", opacity: step.status === "pending" ? 0.4 : 1 } }, statusMark(step.status)), /* @__PURE__ */ React.createElement("span", { className: "hint-text" }, step.label))));
  }

  // src/components/FormFields.tsx
  function TextField({ label, value, onChange, type = "text", placeholder }) {
    return /* @__PURE__ */ React.createElement("label", { className: "field", style: { display: "grid", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--faint)" } }, label), /* @__PURE__ */ React.createElement(
      "input",
      {
        onChange: (event) => onChange(event.target.value),
        placeholder,
        type,
        value
      }
    ));
  }
  function ReadOnlyField({ label, value }) {
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 4 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--faint)" } }, label), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 14, fontWeight: 600 } }, value));
  }
  function ToggleField({ label, checked, onChange }) {
    return /* @__PURE__ */ React.createElement(
      "label",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 0",
          borderBottom: "1px solid var(--line)",
          cursor: "pointer"
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13.5 } }, label),
      /* @__PURE__ */ React.createElement("input", { checked, onChange: (event) => onChange(event.target.checked), type: "checkbox" })
    );
  }

  // src/pages/CameraFormPage.tsx
  function toFormState(camera) {
    var _a, _b, _c, _d;
    return {
      friendlyName: (_a = camera == null ? void 0 : camera.friendlyName) != null ? _a : "",
      rtspHost: (_b = camera == null ? void 0 : camera.rtspHost) != null ? _b : "",
      rtspPort: camera ? String(camera.rtspPort) : "554",
      rtspPath: (_c = camera == null ? void 0 : camera.rtspPath) != null ? _c : "/",
      username: "",
      password: "",
      transport: (_d = camera == null ? void 0 : camera.transport) != null ? _d : "tcp",
      connectionTimeout: "5"
    };
  }
  function CameraFormPage({ cameraId, onBack }) {
    const existing = cameraId ? DEMO_STREAMER_CAMERAS.find((camera) => camera.cameraId === cameraId) : void 0;
    const [form, setForm] = React.useState(() => toFormState(existing));
    const [testSteps, setTestSteps] = React.useState(INITIAL_TEST_STEPS);
    const [testing, setTesting] = React.useState(false);
    function updateField(field, value) {
      setForm((current) => ({ ...current, [field]: value }));
    }
    function runTest() {
      setTesting(true);
      setTestSteps(INITIAL_TEST_STEPS.map((step) => ({ ...step, status: "in_progress" })));
      window.setTimeout(() => {
        setTestSteps(INITIAL_TEST_STEPS.map((step) => ({ ...step, status: "passed" })));
        setTesting(false);
      }, 900);
    }
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Cameras"), /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, cameraId ? "Edit Camera" : "Add Camera"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, form.friendlyName || "New Camera"))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } }, /* @__PURE__ */ React.createElement(TextField, { label: "Friendly Name", onChange: (v) => updateField("friendlyName", v), value: form.friendlyName }), /* @__PURE__ */ React.createElement(TextField, { label: "RTSP Host", onChange: (v) => updateField("rtspHost", v), value: form.rtspHost }), /* @__PURE__ */ React.createElement(TextField, { label: "RTSP Port", onChange: (v) => updateField("rtspPort", v), value: form.rtspPort }), /* @__PURE__ */ React.createElement(TextField, { label: "RTSP Path", onChange: (v) => updateField("rtspPath", v), value: form.rtspPath }), /* @__PURE__ */ React.createElement(TextField, { label: "Username", onChange: (v) => updateField("username", v), value: form.username }), /* @__PURE__ */ React.createElement(
      TextField,
      {
        label: "Password",
        onChange: (v) => updateField("password", v),
        placeholder: cameraId ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : "",
        type: "password",
        value: form.password
      }
    ), /* @__PURE__ */ React.createElement(TextField, { label: "RTSP Transport (tcp/udp)", onChange: (v) => updateField("transport", v), value: form.transport }), /* @__PURE__ */ React.createElement(
      TextField,
      {
        label: "Connection Timeout (s)",
        onChange: (v) => updateField("connectionTimeout", v),
        value: form.connectionTimeout
      }
    )), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 12 } }, "Password is write-only \u2014 the server never returns it after saving (VPS/API_CONTRACT.md \xA72)."), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, cameraId ? "Save Changes" : "Create Camera"))), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Test Camera"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "Connection Check"), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Demo simulation \u2014 the real test polls the device via POST .../cameras/:id/test."))), /* @__PURE__ */ React.createElement(CameraTestSteps, { steps: testSteps }), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: testing, onClick: runTest, type: "button" }, testing ? "Testing\u2026" : "Run Test"))));
  }

  // src/pages/DestinationsPage.tsx
  function credentialNote(expiry) {
    return expiry ? `Expires ${expiry}` : "Persistent";
  }
  function DestinationsPage({ onOpenDestination, onAddDestination }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Demo data \u2014 replace with GET /api/v1/streamer/destinations once the VPS module ships (see VPS/API_CONTRACT.md \xA73).")), /* @__PURE__ */ React.createElement("button", { className: "primary-button", onClick: onAddDestination, type: "button" }, "Add Destination")), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_DESTINATIONS.map((destination) => /* @__PURE__ */ React.createElement("article", { className: "device-card", key: destination.destinationId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, PLATFORM_LABELS[destination.platform].slice(0, 2).toUpperCase()), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, PLATFORM_LABELS[destination.platform]), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, destination.destinationId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, destination.displayName), /* @__PURE__ */ React.createElement("p", null, credentialNote(destination.credentialExpiry))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, destination.enabled ? "Enabled" : "Disabled"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "text-button",
        onClick: () => onOpenDestination(destination.destinationId),
        type: "button"
      },
      "Edit"
    ))))));
  }

  // src/components/DestinationPlatformPicker.tsx
  var PLATFORMS = ["youtube", "facebook", "instagram"];
  function DestinationPlatformPicker({ onPick }) {
    return /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Add Destination"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "Choose a Platform"), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Each platform has its own required fields (Streamer Plugin.txt \xA79)."))), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { justifyContent: "flex-start", gap: 10, flexWrap: "wrap" } }, PLATFORMS.map((platform) => /* @__PURE__ */ React.createElement("button", { className: "text-button", key: platform, onClick: () => onPick(platform), type: "button" }, PLATFORM_LABELS[platform]))));
  }

  // src/destinationForms/YouTubeDestinationForm.tsx
  function YouTubeDestinationForm({ existing }) {
    var _a, _b;
    const [profileName, setProfileName] = React.useState((_a = existing == null ? void 0 : existing.displayName) != null ? _a : "");
    const [channelName, setChannelName] = React.useState("");
    const [serverUrl, setServerUrl] = React.useState("rtmps://a.rtmps.youtube.com/live2");
    const [streamKey, setStreamKey] = React.useState("");
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } }, /* @__PURE__ */ React.createElement(TextField, { label: "Profile Name", onChange: setProfileName, value: profileName }), /* @__PURE__ */ React.createElement(TextField, { label: "Channel Name", onChange: setChannelName, value: channelName }), /* @__PURE__ */ React.createElement(TextField, { label: "RTMPS Server URL", onChange: setServerUrl, value: serverUrl }), /* @__PURE__ */ React.createElement(
      TextField,
      {
        label: "Stream Key",
        onChange: setStreamKey,
        placeholder: (existing == null ? void 0 : existing.hasStreamKey) ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : "Reusable or temporary key",
        type: "password",
        value: streamKey
      }
    ), /* @__PURE__ */ React.createElement(ReadOnlyField, { label: "Credential Status", value: (existing == null ? void 0 : existing.hasStreamKey) ? "Configured" : "Not set" }), /* @__PURE__ */ React.createElement(ReadOnlyField, { label: "Last Validation", value: (_b = existing == null ? void 0 : existing.lastValidatedAt) != null ? _b : "Never validated" }));
  }

  // src/destinationForms/FacebookDestinationForm.tsx
  function FacebookDestinationForm({ existing }) {
    var _a, _b, _c, _d;
    const [profileName, setProfileName] = React.useState((_a = existing == null ? void 0 : existing.displayName) != null ? _a : "");
    const [pageName, setPageName] = React.useState("");
    const [serverUrl, setServerUrl] = React.useState("rtmps://live-api-s.facebook.com:443/rtmp/");
    const [streamKey, setStreamKey] = React.useState("");
    const [keyMode, setKeyMode] = React.useState((_b = existing == null ? void 0 : existing.credentialMode) != null ? _b : "persistent");
    const [expiry, setExpiry] = React.useState((_c = existing == null ? void 0 : existing.credentialExpiry) != null ? _c : "");
    return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } }, /* @__PURE__ */ React.createElement(TextField, { label: "Profile Name", onChange: setProfileName, value: profileName }), /* @__PURE__ */ React.createElement(TextField, { label: "Page / Destination Name", onChange: setPageName, value: pageName }), /* @__PURE__ */ React.createElement(TextField, { label: "RTMPS Server URL", onChange: setServerUrl, value: serverUrl }), /* @__PURE__ */ React.createElement(
      TextField,
      {
        label: "Stream Key",
        onChange: setStreamKey,
        placeholder: (existing == null ? void 0 : existing.hasStreamKey) ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : "Persistent or temporary key",
        type: "password",
        value: streamKey
      }
    ), /* @__PURE__ */ React.createElement(TextField, { label: "Key Mode (persistent/temporary)", onChange: setKeyMode, value: keyMode }), /* @__PURE__ */ React.createElement(TextField, { label: "Credential Expiry", onChange: setExpiry, placeholder: "YYYY-MM-DDTHH:mm:ssZ", value: expiry }), /* @__PURE__ */ React.createElement(ReadOnlyField, { label: "Last Validation", value: (_d = existing == null ? void 0 : existing.lastValidatedAt) != null ? _d : "Never validated" }));
  }

  // src/destinationForms/InstagramDestinationForm.tsx
  function InstagramDestinationForm({ existing }) {
    var _a, _b, _c;
    const [profileName, setProfileName] = React.useState((_a = existing == null ? void 0 : existing.displayName) != null ? _a : "");
    const [accountLabel, setAccountLabel] = React.useState("");
    const [serverUrl, setServerUrl] = React.useState("");
    const [streamKey, setStreamKey] = React.useState("");
    const [expiry, setExpiry] = React.useState((_b = existing == null ? void 0 : existing.credentialExpiry) != null ? _b : "");
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginBottom: 12, fontWeight: 600 } }, "Instagram stream credentials may be temporary. Update and validate the server URL and stream key before the scheduled broadcast."), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } }, /* @__PURE__ */ React.createElement(TextField, { label: "Profile Name", onChange: setProfileName, value: profileName }), /* @__PURE__ */ React.createElement(TextField, { label: "Instagram Account Label", onChange: setAccountLabel, value: accountLabel }), /* @__PURE__ */ React.createElement(TextField, { label: "Live Producer Server URL", onChange: setServerUrl, value: serverUrl }), /* @__PURE__ */ React.createElement(
      TextField,
      {
        label: "Temporary Stream Key",
        onChange: setStreamKey,
        placeholder: (existing == null ? void 0 : existing.hasStreamKey) ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (leave blank to keep)" : "Temporary key",
        type: "password",
        value: streamKey
      }
    ), /* @__PURE__ */ React.createElement(TextField, { label: "Credential Expiry", onChange: setExpiry, placeholder: "YYYY-MM-DDTHH:mm:ssZ", value: expiry }), /* @__PURE__ */ React.createElement(ReadOnlyField, { label: "Last Updated", value: (_c = existing == null ? void 0 : existing.lastValidatedAt) != null ? _c : "Never updated" })));
  }

  // src/pages/DestinationFormPage.tsx
  var PLATFORM_FORMS = {
    youtube: YouTubeDestinationForm,
    facebook: FacebookDestinationForm,
    instagram: InstagramDestinationForm
  };
  function findExisting(destinationId) {
    return destinationId ? DEMO_STREAMER_DESTINATIONS.find((destination) => destination.destinationId === destinationId) : void 0;
  }
  function DestinationFormPage({ destinationId, onBack }) {
    var _a;
    const existing = findExisting(destinationId);
    const [chosenPlatform, setChosenPlatform] = React.useState((_a = existing == null ? void 0 : existing.platform) != null ? _a : null);
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Destinations"), !chosenPlatform ? /* @__PURE__ */ React.createElement(DestinationPlatformPicker, { onPick: setChosenPlatform }) : /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, existing ? "Edit Destination" : "Add Destination"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, PLATFORM_LABELS[chosenPlatform]))), React.createElement(PLATFORM_FORMS[chosenPlatform], { existing }), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 12 } }, "Stream keys and OAuth references are write-only \u2014 never returned by the server after saving (VPS/API_CONTRACT.md \xA73)."), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, "Validate Destination"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, existing ? "Save Changes" : "Create Destination"))));
  }

  // src/pages/SchedulesPage.tsx
  function SchedulesPage({ onOpenSchedule, onAddSchedule }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Demo data \u2014 replace with GET /api/v1/streamer/schedules once the VPS module ships. Each of these is stored as a paired start/stop Scene under the hood (see VPS/API_CONTRACT.md \xA74) \u2014 this page never needs to know that.")), /* @__PURE__ */ React.createElement("button", { className: "primary-button", onClick: onAddSchedule, type: "button" }, "Add Schedule")), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_SCHEDULES.map((schedule) => /* @__PURE__ */ React.createElement("article", { className: "device-card", key: schedule.scheduleId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, schedule.startLocalTime.slice(0, 2), "h"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, schedule.startLocalTime, "\u2013", schedule.stopLocalTime, " \xB7 ", schedule.timezone), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, schedule.scheduleId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, schedule.name), /* @__PURE__ */ React.createElement("p", null, schedule.daysOfWeek.join(", "))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Device"), /* @__PURE__ */ React.createElement("dd", null, schedule.deviceId)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Priority"), /* @__PURE__ */ React.createElement("dd", null, schedule.priority))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, schedule.enabled ? "Enabled" : "Disabled"), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "text-button",
        onClick: () => onOpenSchedule(schedule.scheduleId),
        type: "button"
      },
      "Edit"
    ))))));
  }

  // src/pages/ScheduleFormPage.tsx
  function ScheduleFormPage({ scheduleId, onBack }) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const existing = scheduleId ? DEMO_STREAMER_SCHEDULES.find((schedule) => schedule.scheduleId === scheduleId) : void 0;
    const [name, setName] = React.useState((_a = existing == null ? void 0 : existing.name) != null ? _a : "");
    const [deviceId, setDeviceId] = React.useState((_b = existing == null ? void 0 : existing.deviceId) != null ? _b : "");
    const [cameraId, setCameraId] = React.useState((_c = existing == null ? void 0 : existing.cameraId) != null ? _c : "");
    const [destinationId, setDestinationId] = React.useState((_d = existing == null ? void 0 : existing.destinationId) != null ? _d : "");
    const [timezone, setTimezone] = React.useState((_e = existing == null ? void 0 : existing.timezone) != null ? _e : "Asia/Kolkata");
    const [startTime, setStartTime] = React.useState((_f = existing == null ? void 0 : existing.startLocalTime) != null ? _f : "18:00");
    const [stopTime, setStopTime] = React.useState((_g = existing == null ? void 0 : existing.stopLocalTime) != null ? _g : "19:00");
    const [days, setDays] = React.useState((_h = existing == null ? void 0 : existing.daysOfWeek) != null ? _h : []);
    function toggleDay(day) {
      setDays((current) => current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
    }
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Schedules"), /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, scheduleId ? "Edit Schedule" : "Add Schedule"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, name || "New Schedule"))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" } }, /* @__PURE__ */ React.createElement(TextField, { label: "Schedule Name", onChange: setName, value: name }), /* @__PURE__ */ React.createElement(TextField, { label: "Device ID", onChange: setDeviceId, value: deviceId }), /* @__PURE__ */ React.createElement(TextField, { label: "Camera ID", onChange: setCameraId, value: cameraId }), /* @__PURE__ */ React.createElement(TextField, { label: "Destination ID", onChange: setDestinationId, value: destinationId }), /* @__PURE__ */ React.createElement(TextField, { label: "Timezone", onChange: setTimezone, value: timezone }), /* @__PURE__ */ React.createElement(TextField, { label: "Start Time", onChange: setStartTime, value: startTime }), /* @__PURE__ */ React.createElement(TextField, { label: "Stop Time", onChange: setStopTime, value: stopTime })), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 12, color: "var(--faint)" } }, "Days of Week"), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { justifyContent: "flex-start", gap: 6, marginTop: 6, flexWrap: "wrap" } }, WEEKDAYS.map((day) => /* @__PURE__ */ React.createElement(
      "button",
      {
        className: days.includes(day) ? "primary-button" : "text-button",
        key: day,
        onClick: () => toggleDay(day),
        type: "button"
      },
      day
    )))), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 12 } }, "Stored server-side as a paired start/stop Scene (VPS/API_CONTRACT.md \xA74). Overlapping schedules for the same device are rejected with SCHEDULE_CONFLICT."), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, "Run Now"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, scheduleId ? "Save Changes" : "Create Schedule"))));
  }

  // src/pages/LiveSessionsPage.tsx
  function LiveSessionsPage({ onOpenSession }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginBottom: 16 } }, "Demo data \u2014 replace with GET /api/v1/streamer/sessions once the VPS module ships. Polled every 10\u201330s while this page is open (Streamer Plugin.txt \xA725); never embeds video."), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_SESSIONS.map((session) => /* @__PURE__ */ React.createElement("article", { className: "device-card", key: session.sessionId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, session.status === "STREAMING" ? "\u25CF" : "\u25CB"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, PLATFORM_LABELS[session.platform]), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, session.sessionId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, session.deviceId), /* @__PURE__ */ React.createElement("p", null, session.status === "STREAMING" ? "Live now" : `Stopped ${session.stoppedAt}`)), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Trigger"), /* @__PURE__ */ React.createElement("dd", null, session.triggerSource)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Reconnects"), /* @__PURE__ */ React.createElement("dd", null, session.reconnectCount))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, session.connectionStatus), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenSession(session.sessionId), type: "button" }, "View"))))));
  }

  // src/pages/LiveSessionDetailPage.tsx
  var PLATFORM_LINKS = {
    youtube: "View on YouTube",
    facebook: "View on Facebook",
    instagram: "View on Instagram"
  };
  function LiveSessionDetailPage({ sessionId, onBack }) {
    const session = DEMO_STREAMER_SESSIONS.find((entry) => entry.sessionId === sessionId);
    if (!session) {
      return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton2, { onBack }), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Session not found.")));
    }
    const isLive = session.status === "STREAMING";
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton2, { onBack }), /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, PLATFORM_LABELS[session.platform]), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, session.deviceId), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, session.sessionId, " \xB7 ", isLive ? "Live now" : "Stopped"))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Camera"), /* @__PURE__ */ React.createElement("dd", null, session.cameraId)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Trigger Source"), /* @__PURE__ */ React.createElement("dd", null, session.triggerSource)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Video Mode"), /* @__PURE__ */ React.createElement("dd", null, session.videoMode)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Audio Mode"), /* @__PURE__ */ React.createElement("dd", null, session.audioMode)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Connection"), /* @__PURE__ */ React.createElement("dd", null, session.connectionStatus)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Reconnect Count"), /* @__PURE__ */ React.createElement("dd", null, session.reconnectCount)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Duration"), /* @__PURE__ */ React.createElement("dd", null, formatDuration(session.startTime, session.stoppedAt))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Bitrate"), /* @__PURE__ */ React.createElement("dd", null, session.currentBitrateKbps ? `${session.currentBitrateKbps} kbps` : "Unavailable")))), /* @__PURE__ */ React.createElement(
      DetailSection,
      {
        note: "Video never renders here \u2014 the Smart Streamer control plane does not carry the stream (Streamer Plugin.txt \xA711). This is not the PWA receiving live video.",
        title: "Video"
      }
    ), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Actions"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "Session Actions"))), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { justifyContent: "flex-start", flexWrap: "wrap", gap: 8 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: !isLive, type: "button" }, "Stop Normally"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: !isLive, type: "button" }, "Force Stop"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: !isLive, type: "button" }, "Extend Stop Time"), /* @__PURE__ */ React.createElement("button", { className: "text-button", type: "button" }, "Open Diagnostics"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: !isLive, type: "button" }, PLATFORM_LINKS[session.platform])), /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 8 } }, "Force Stop requires smart_streamer.stream.force_stop and is always audit-logged (Streamer Plugin.txt \xA717, \xA727). Wired to POST /api/v1/devices/:deviceId/streamer/sessions/... once the VPS module ships.")));
  }
  function BackButton2({ onBack }) {
    return /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Live Sessions");
  }

  // src/errorCodeExplanations.ts
  var ERROR_CODE_EXPLANATIONS = {
    CAMERA_AUTH_FAILED: "Camera username or password was rejected.",
    CAMERA_TIMEOUT: "The camera did not respond within the expected time.",
    CAMERA_CODEC_UNSUPPORTED: "The camera's video codec isn't supported by this device.",
    CAMERA_NO_KEYFRAME: "No keyframe was received from the camera \u2014 check the stream is active.",
    AUDIO_CODEC_UNSUPPORTED: "The camera's audio codec can't be used or transcoded.",
    DESTINATION_CREDENTIAL_EXPIRED: "The destination's stream key or credentials have expired.",
    RTMP_HANDSHAKE_FAILED: "The connection to the streaming platform was rejected.",
    DEVICE_ALREADY_STREAMING: "This device already has an active stream.",
    SESSION_NOT_AUTHORIZED: "The server did not authorize this streaming session.",
    TIME_NOT_SYNCHRONIZED: "The device's clock isn't synchronized yet \u2014 this usually resolves itself shortly after startup.",
    TLS_CERTIFICATE_FAILED: "The device couldn't verify the server's security certificate.",
    SIGNATURE_INVALID: "The device's security credentials need to be re-provisioned.",
    CLOCK_SKEW: "The device's clock is out of sync with the server."
  };
  function explainErrorCode(code) {
    var _a;
    if (!code) {
      return "No recent errors.";
    }
    return (_a = ERROR_CODE_EXPLANATIONS[code]) != null ? _a : "An unrecognized error occurred.";
  }

  // src/pages/DiagnosticsPage.tsx
  function DiagnosticsPage({ onOpenDevice }) {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginBottom: 16 } }, "Demo data \u2014 replace with GET /api/v1/streamer/devices/:deviceId/health once the VPS module ships (see VPS/API_CONTRACT.md \xA76)."), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_DEVICE_HEALTH.map((health) => /* @__PURE__ */ React.createElement("article", { className: "device-card", key: health.deviceId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, health.lastError ? "!" : "OK"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, health.onlineStatus === "online" ? "Online" : "Offline"), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, health.deviceId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, health.rtspState, " / ", health.rtmpState), /* @__PURE__ */ React.createElement("p", null, explainErrorCode(health.lastError))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "WiFi RSSI"), /* @__PURE__ */ React.createElement("dd", null, health.wifiRssi, " dBm")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Reconnects"), /* @__PURE__ */ React.createElement("dd", null, health.reconnectCount))), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, health.timeSynchronized ? "Time synced" : "Time not synced"), /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => onOpenDevice(health.deviceId), type: "button" }, "Open Diagnostics"))))));
  }

  // src/pages/DeviceDiagnosticsPage.tsx
  function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
  }
  function DeviceDiagnosticsPage({ deviceId, onBack }) {
    var _a;
    const health = DEMO_DEVICE_HEALTH.find((entry) => entry.deviceId === deviceId);
    const [showAdvanced, setShowAdvanced] = React.useState(false);
    if (!health) {
      return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton3, { onBack }), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Device not found.")));
    }
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement(BackButton3, { onBack }), health.lastError ? /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Last Error"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, explainErrorCode(health.lastError)), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Technical code: ", health.lastError)) : null, /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Connectivity"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, health.deviceId), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Last seen ", health.lastSeenAt))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Status"), /* @__PURE__ */ React.createElement("dd", null, health.onlineStatus)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Uptime"), /* @__PURE__ */ React.createElement("dd", null, formatUptime(health.uptimeSeconds))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "WiFi RSSI"), /* @__PURE__ */ React.createElement("dd", null, health.wifiRssi, " dBm")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "IP Address"), /* @__PURE__ */ React.createElement("dd", null, health.ipAddress)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Time Sync"), /* @__PURE__ */ React.createElement("dd", null, health.timeSynchronized ? "Synchronized" : "Not synchronized")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Reconnect Count"), /* @__PURE__ */ React.createElement("dd", null, health.reconnectCount)))), /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Camera & Streaming"))), /* @__PURE__ */ React.createElement("dl", { className: "summary-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Camera Connection"), /* @__PURE__ */ React.createElement("dd", null, health.cameraConnection)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "RTSP State"), /* @__PURE__ */ React.createElement("dd", null, health.rtspState)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "RTMP State"), /* @__PURE__ */ React.createElement("dd", null, health.rtmpState)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Current Session"), /* @__PURE__ */ React.createElement("dd", null, (_a = health.currentSessionId) != null ? _a : "None")))), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: () => setShowAdvanced((current) => !current), type: "button" }, showAdvanced ? "Hide Advanced Details" : "Show Advanced Details"), /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, "Download Diagnostic Report")), showAdvanced ? /* @__PURE__ */ React.createElement("dl", { className: "summary-grid", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Reset Reason"), /* @__PURE__ */ React.createElement("dd", null, health.resetReason)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Free Heap"), /* @__PURE__ */ React.createElement("dd", null, health.freeHeap.toLocaleString(), " B")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Min Free Heap"), /* @__PURE__ */ React.createElement("dd", null, health.minFreeHeap.toLocaleString(), " B")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Largest Free Block"), /* @__PURE__ */ React.createElement("dd", null, health.largestFreeBlock.toLocaleString(), " B")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "PSRAM"), /* @__PURE__ */ React.createElement("dd", null, health.psramStatus)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Firmware / Hardware"), /* @__PURE__ */ React.createElement("dd", null, health.firmwareVersion, " / ", health.hardwareRevision))) : null, /* @__PURE__ */ React.createElement("p", { className: "hint-text", style: { marginTop: 12 } }, "The export never includes camera password, stream key, device signing key, WiFi password, or a complete authenticated RTSP URL (Streamer Plugin.txt \xA715).")));
  }
  function BackButton3({ onBack }) {
    return /* @__PURE__ */ React.createElement("button", { className: "text-button", onClick: onBack, style: { marginBottom: 12 }, type: "button" }, "\u2190 Back to Diagnostics");
  }

  // src/pages/OtaPage.tsx
  function OtaPage() {
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Firmware updates for Smart Streamer devices use the platform's existing OTA system \u2014 the same rollout, staging, and rollback flow every other Jenix device uses. There is no separate Smart Streamer update flow to learn.")), /* @__PURE__ */ React.createElement("div", { className: "content-grid" }, DEMO_STREAMER_DEVICES.map((device) => {
      const blocked = device.streamState === "STREAMING";
      return /* @__PURE__ */ React.createElement("article", { className: "device-card", key: device.deviceId }, /* @__PURE__ */ React.createElement("div", { className: "device-card-head" }, /* @__PURE__ */ React.createElement("div", { className: "device-icon" }, "FW"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "device-pid-label" }, "Firmware ", device.firmwareVersion), /* @__PURE__ */ React.createElement("p", { className: "device-pid-code" }, device.deviceId))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", null, device.friendlyName), /* @__PURE__ */ React.createElement("p", null, blocked ? "Stop the active stream before updating firmware." : "Available for update \u2014 no active stream.")), /* @__PURE__ */ React.createElement("div", { className: "card-actions" }, /* @__PURE__ */ React.createElement("span", null, blocked ? "Update blocked" : "Update allowed"), /* @__PURE__ */ React.createElement("a", { className: "text-button", href: `/devices/${device.deviceId}` }, "Manage Firmware")));
    })));
  }

  // src/demoNotificationPrefs.ts
  var DEMO_NOTIFICATION_PREFS = [
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

  // src/pages/DeviceSettingsPage.tsx
  function DeviceSettingsPage() {
    const [prefs, setPrefs] = React.useState(DEMO_NOTIFICATION_PREFS);
    const [transport, setTransport] = React.useState("tcp");
    const [timeout, setTimeoutValue] = React.useState("5");
    const [rotation, setRotation] = React.useState("0");
    function togglePref(eventId, enabled) {
      setPrefs(
        (current) => current.map((pref) => pref.eventId === eventId ? { ...pref, enabled } : pref)
      );
    }
    return /* @__PURE__ */ React.createElement("section", null, /* @__PURE__ */ React.createElement("article", { className: "panel", style: { marginBottom: 16 } }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Notifications"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "Stream Event Preferences"), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Per-user, deduplicated and cooldown-limited server-side (Streamer Plugin.txt \xA716). Demo toggles \u2014 wired once the platform notification framework exists (see SMART_STREAMER_PLATFORM_ADDITIONS.md item 3)."))), /* @__PURE__ */ React.createElement("div", { style: { marginTop: 8 } }, prefs.map((pref) => /* @__PURE__ */ React.createElement(
      ToggleField,
      {
        checked: pref.enabled,
        key: pref.eventId,
        label: pref.label,
        onChange: (checked) => togglePref(pref.eventId, checked)
      }
    ))), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, "Save Preferences"))), /* @__PURE__ */ React.createElement("article", { className: "panel" }, /* @__PURE__ */ React.createElement("div", { className: "scene-section-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { className: "eyebrow" }, "Camera Defaults"), /* @__PURE__ */ React.createElement("h2", { style: { marginBottom: 4 } }, "New Camera Defaults"), /* @__PURE__ */ React.createElement("p", { className: "hint-text" }, "Applied when creating a new camera profile \u2014 override per-camera on the Cameras page at any time."))), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 8 } }, /* @__PURE__ */ React.createElement(TextField, { label: "Default RTSP Transport", onChange: setTransport, value: transport }), /* @__PURE__ */ React.createElement(TextField, { label: "Default Connection Timeout (s)", onChange: setTimeoutValue, value: timeout }), /* @__PURE__ */ React.createElement(TextField, { label: "Default Rotation (deg)", onChange: setRotation, value: rotation })), /* @__PURE__ */ React.createElement("div", { className: "card-actions", style: { marginTop: 12 } }, /* @__PURE__ */ React.createElement("button", { className: "text-button", disabled: true, type: "button" }, "Save Defaults"))));
  }

  // src/StreamerSectionContent.tsx
  var SIMPLE_PAGES = {
    ota: OtaPage,
    settings: DeviceSettingsPage
  };
  function DevicesSection() {
    const [selectedDeviceId, setSelectedDeviceId] = React.useState(null);
    return selectedDeviceId ? /* @__PURE__ */ React.createElement(DeviceDetailPage, { deviceId: selectedDeviceId, onBack: () => setSelectedDeviceId(null) }) : /* @__PURE__ */ React.createElement(DevicesPage, { onOpenDevice: setSelectedDeviceId });
  }
  function CamerasSection() {
    const [selectedCameraId, setSelectedCameraId] = React.useState(null);
    return selectedCameraId !== null ? /* @__PURE__ */ React.createElement(
      CameraFormPage,
      {
        cameraId: selectedCameraId === "new" ? null : selectedCameraId,
        onBack: () => setSelectedCameraId(null)
      }
    ) : /* @__PURE__ */ React.createElement(CamerasPage, { onAddCamera: () => setSelectedCameraId("new"), onOpenCamera: setSelectedCameraId });
  }
  function DestinationsSection() {
    const [selectedDestinationId, setSelectedDestinationId] = React.useState(null);
    return selectedDestinationId !== null ? /* @__PURE__ */ React.createElement(
      DestinationFormPage,
      {
        destinationId: selectedDestinationId === "new" ? null : selectedDestinationId,
        onBack: () => setSelectedDestinationId(null)
      }
    ) : /* @__PURE__ */ React.createElement(
      DestinationsPage,
      {
        onAddDestination: () => setSelectedDestinationId("new"),
        onOpenDestination: setSelectedDestinationId
      }
    );
  }
  function SchedulesSection() {
    const [selectedScheduleId, setSelectedScheduleId] = React.useState(null);
    return selectedScheduleId !== null ? /* @__PURE__ */ React.createElement(
      ScheduleFormPage,
      {
        onBack: () => setSelectedScheduleId(null),
        scheduleId: selectedScheduleId === "new" ? null : selectedScheduleId
      }
    ) : /* @__PURE__ */ React.createElement(
      SchedulesPage,
      {
        onAddSchedule: () => setSelectedScheduleId("new"),
        onOpenSchedule: setSelectedScheduleId
      }
    );
  }
  function SessionsSection() {
    const [selectedSessionId, setSelectedSessionId] = React.useState(null);
    return selectedSessionId ? /* @__PURE__ */ React.createElement(LiveSessionDetailPage, { onBack: () => setSelectedSessionId(null), sessionId: selectedSessionId }) : /* @__PURE__ */ React.createElement(LiveSessionsPage, { onOpenSession: setSelectedSessionId });
  }
  function DiagnosticsSection() {
    const [selectedDeviceId, setSelectedDeviceId] = React.useState(null);
    return selectedDeviceId ? /* @__PURE__ */ React.createElement(DeviceDiagnosticsPage, { deviceId: selectedDeviceId, onBack: () => setSelectedDeviceId(null) }) : /* @__PURE__ */ React.createElement(DiagnosticsPage, { onOpenDevice: setSelectedDeviceId });
  }
  function StreamerSectionContent({ section, onNavigate }) {
    if (section === "overview") {
      return /* @__PURE__ */ React.createElement(OverviewPage, { onNavigate });
    }
    if (section === "devices") {
      return /* @__PURE__ */ React.createElement(DevicesSection, null);
    }
    if (section === "cameras") {
      return /* @__PURE__ */ React.createElement(CamerasSection, null);
    }
    if (section === "destinations") {
      return /* @__PURE__ */ React.createElement(DestinationsSection, null);
    }
    if (section === "schedules") {
      return /* @__PURE__ */ React.createElement(SchedulesSection, null);
    }
    if (section === "sessions") {
      return /* @__PURE__ */ React.createElement(SessionsSection, null);
    }
    if (section === "diagnostics") {
      return /* @__PURE__ */ React.createElement(DiagnosticsSection, null);
    }
    const Page = SIMPLE_PAGES[section];
    return Page ? /* @__PURE__ */ React.createElement(Page, null) : /* @__PURE__ */ React.createElement(OverviewPage, { onNavigate });
  }

  // src/SmartStreamerApp.tsx
  function SmartStreamerApp(_props) {
    var _a, _b;
    const [active, setActive] = React.useState("overview");
    const activeLabel = (_b = (_a = STREAMER_SECTIONS.find((section) => section.id === active)) == null ? void 0 : _a.label) != null ? _b : "Overview";
    return /* @__PURE__ */ React.createElement("div", { style: { maxWidth: 960, margin: "0 auto", padding: "24px 20px 40px" } }, /* @__PURE__ */ React.createElement("header", { style: { marginBottom: 20 } }, /* @__PURE__ */ React.createElement(
      "span",
      {
        style: {
          color: "#67707c",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase"
        }
      },
      "Smart Streamer"
    ), /* @__PURE__ */ React.createElement("h1", { style: { margin: "4px 0 0", fontSize: "clamp(1.5rem, 4vw, 2.1rem)" } }, activeLabel)), /* @__PURE__ */ React.createElement(SectionTabs, { active, onSelect: setActive }), /* @__PURE__ */ React.createElement(StreamerSectionContent, { key: active, onNavigate: setActive, section: active }));
  }

  // src/index.tsx
  host.registerPackage({
    packageId: "smart-streamer-plugin",
    version: "1.0.0",
    exports: {
      SmartStreamerApp
    }
  });
})();
