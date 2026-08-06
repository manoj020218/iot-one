import type { ProductStatus, SceneActionCommand } from "@jenix/shared";

import type { MatterMode } from "../matter/matter.types";

export type PidBrand = "JENIX";

export type MatterCertificationStatus =
  | "not_started"
  | "testing"
  | "certified"
  | "not_required";

export interface PidIdentity {
  pid: string;
  productName: string;
  productCategory: string;
  productLine: string;
  status: ProductStatus;
  matterMode: MatterMode;
}

export interface PidHardwareProfile {
  mcu: string;
  hardwareRevision: string;
  pcbRevision?: string;
  powerType?: string;
  inputCount?: number;
  outputCount?: number;
  relayCount?: number;
  hasRs485: boolean;
  hasBle: boolean;
  hasWifi: boolean;
  hasMatter: boolean;
  hasThread: boolean;
  hasEthernet: boolean;
  notes?: string;
}

export interface PidFirmwareProfile {
  firmwareFamily: string;
  otaChannel: string;
  stableVersion?: string;
  betaVersion?: string;
  minHardwareRevision?: string;
  maxHardwareRevision?: string;
  rollbackAllowed: boolean;
  buildNotes?: string;
}

export interface PidMatterProfile {
  enabled: boolean;
  mode: MatterMode;
  deviceType?: string;
  endpoints?: Array<Record<string, unknown>>;
  clusters?: string[];
  vendorId?: string;
  productId?: string;
  discriminator?: string;
  certificationStatus?: MatterCertificationStatus;
  bridgeSupported: boolean;
}

export interface PidApiProfile {
  enabled: boolean;
  defaultPackageId?: string;
  sellable: boolean;
  allowedScopes: string[];
  webhookSupport?: boolean;
  mqttBridgeSupport?: boolean;
}

export type PidUiMode = "builtin" | "remote-package";

export interface PidUiProfile {
  uiMode: PidUiMode;
  uiPackageId?: string;
  uiPackageVersion?: string;
}

export interface PidDashboardProfile {
  templateId: string;
  dynamicPages: string[];
  icon?: string;
  cardLayout?: string;
}

/**
 * One command this device type accepts through a scene/schedule action.
 * `command` must be one of the shared platform's SceneActionCommand values
 * (see packages/shared/src/types/scene.ts) — a new device-specific command
 * name has to be added there first, then referenced here. See SCHEDULE.md
 * for the full "how does my device plug into the platform schedule" guide.
 */
export interface PidAutomationCommandDescriptor {
  command: SceneActionCommand;
  label: string;
  restricted?: boolean;
}

export interface PidAutomationProfile {
  commands: PidAutomationCommandDescriptor[];
}

export interface CreatePidInput extends PidIdentity {
  brand: PidBrand;
  description?: string;
  iconUrl?: string;
  imageUrl?: string;
  hardware: PidHardwareProfile;
  firmware: PidFirmwareProfile;
  matter: PidMatterProfile;
  api: PidApiProfile;
  ui: PidUiProfile;
  dashboard: PidDashboardProfile;
  /**
   * Optional: which scene/schedule commands this device type supports. When
   * absent, the Scene builder falls back to the full platform command list
   * (today's behavior) instead of showing nothing — declaring this is
   * opt-in but recommended so users only see commands your device actually
   * understands.
   */
  automation?: PidAutomationProfile;
}

export interface ProductPidRecord extends CreatePidInput {
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const foundationPidRecord: PidIdentity = {
  pid: "JNX-TG-C3-001",
  productName: "Smart Tank Guard",
  productCategory: "Water Monitoring",
  productLine: "Tank Guard",
  status: "draft",
  matterMode: "NONE"
};

export const foundationPidBlueprint: CreatePidInput = {
  ...foundationPidRecord,
  brand: "JENIX",
  description: "Base PID blueprint for Tank Guard class products.",
  hardware: {
    mcu: "ESP32-C3",
    hardwareRevision: "HW1.0",
    hasRs485: false,
    hasBle: true,
    hasWifi: true,
    hasMatter: false,
    hasThread: false,
    hasEthernet: false
  },
  firmware: {
    firmwareFamily: "tank-guard",
    otaChannel: "beta",
    betaVersion: "0.9.0",
    rollbackAllowed: true
  },
  matter: {
    enabled: false,
    mode: "NONE",
    certificationStatus: "not_required",
    bridgeSupported: false
  },
  api: {
    enabled: false,
    sellable: false,
    allowedScopes: []
  },
  ui: {
    uiMode: "remote-package",
    uiPackageId: "tank-guard-mobile",
    uiPackageVersion: "1.0.0"
  },
  dashboard: {
    templateId: "tank-guard-default",
    dynamicPages: ["tank-level", "thresholds"]
  },
  automation: {
    commands: [
      { command: "refresh", label: "Refresh reading" },
      { command: "zero_calibrate", label: "Zero calibrate sensor" },
      { command: "motor_on", label: "Turn pump on" },
      { command: "motor_off", label: "Turn pump off" },
      { command: "alarm_test", label: "Test alarm" }
    ]
  }
};

export const smartStreamerPidRecord: PidIdentity = {
  pid: "JNX-SS-P4-001",
  productName: "Smart Streamer",
  productCategory: "Live Streaming",
  productLine: "Smart Streamer",
  status: "draft",
  matterMode: "NONE"
};

export const smartStreamerPidBlueprint: CreatePidInput = {
  ...smartStreamerPidRecord,
  brand: "JENIX",
  description:
    "Streams one assigned IP CCTV camera to one selected platform (YouTube, " +
    "Facebook, or Instagram) at a time. Video never transits the Jenix VPS.",
  hardware: {
    mcu: "ESP32-P4",
    hardwareRevision: "HW1.0",
    hasRs485: false,
    hasBle: true,
    hasWifi: true,
    hasMatter: false,
    hasThread: false,
    hasEthernet: false
  },
  firmware: {
    firmwareFamily: "smart-streamer",
    otaChannel: "beta",
    betaVersion: "1.0.0",
    rollbackAllowed: true
  },
  matter: {
    enabled: false,
    mode: "NONE",
    certificationStatus: "not_required",
    bridgeSupported: false
  },
  api: {
    enabled: false,
    sellable: false,
    allowedScopes: []
  },
  ui: {
    uiMode: "remote-package",
    uiPackageId: "smart-streamer-plugin",
    uiPackageVersion: "1.0.0"
  },
  dashboard: {
    templateId: "smart-streamer-default",
    dynamicPages: []
  },
  automation: {
    commands: [
      { command: "start_stream", label: "Start stream" },
      { command: "stop_stream", label: "Stop stream" }
    ]
  }
};
