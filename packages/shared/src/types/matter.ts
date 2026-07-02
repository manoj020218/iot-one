export type MatterMode =
  | "NONE"
  | "NATIVE_MATTER"
  | "MATTER_BRIDGE_CHILD"
  | "MATTER_BRIDGE_GATEWAY";

export type MatterReadinessState =
  | "not_supported"
  | "disabled"
  | "ready_to_commission"
  | "bridge_ready"
  | "bridge_child";

export type MatterCommissioningState =
  | "not_supported"
  | "disabled"
  | "ready"
  | "requested"
  | "bridge_child_only";

export type MatterBridgeState =
  | "not_supported"
  | "disabled"
  | "not_required"
  | "gateway_ready"
  | "sync_requested"
  | "child_waiting_for_gateway";

export type MatterCertificationStatus =
  | "not_started"
  | "testing"
  | "certified"
  | "not_required";

export interface MatterMappingSummary {
  deviceType?: string;
  endpoints: Array<Record<string, unknown>>;
  clusters: string[];
  vendorId?: string;
  productId?: string;
  discriminator?: string;
  certificationStatus?: MatterCertificationStatus;
  bridgeSupported: boolean;
}

export interface MatterDeviceStatus {
  deviceId: string;
  pid: string;
  enabled: boolean;
  deviceMatterEnabled: boolean;
  hardwareMatterCapable: boolean;
  mode: MatterMode;
  readiness: MatterReadinessState;
  commissioningState: MatterCommissioningState;
  bridgeState: MatterBridgeState;
  mapping: MatterMappingSummary;
  notes: string[];
  lastCommissioningAttemptAt?: string;
  lastBridgeSyncAt?: string;
}

export type MatterPlaceholderAction = "commission" | "bridge_sync";

export interface MatterPlaceholderActionResult {
  deviceId: string;
  pid: string;
  mode: MatterMode;
  action: MatterPlaceholderAction;
  status: "accepted";
  placeholder: true;
  requestedAt: string;
  message: string;
}
