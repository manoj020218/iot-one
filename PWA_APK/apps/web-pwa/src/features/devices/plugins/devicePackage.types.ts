import type {
  DeviceRecord,
  DeviceUiCommandRequest,
  DeviceUiRuntimeState
} from "@jenix/shared";
import type { ComponentType } from "react";

import type { DevicePidProfile } from "../services/deviceManagementApi";

export interface DevicePackageRenderProps {
  device: DeviceRecord;
  pidProfile: DevicePidProfile;
  runtime: DeviceUiRuntimeState;
  busy?: boolean | undefined;
  onRefresh: () => Promise<void>;
  onCommand: (input: DeviceUiCommandRequest) => Promise<void>;
}

export type DevicePackageComponent = ComponentType<DevicePackageRenderProps>;
