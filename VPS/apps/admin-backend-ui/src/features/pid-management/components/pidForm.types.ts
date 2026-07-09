import type {
  CreatePidInput,
  PidApiProfile,
  PidDashboardProfile,
  PidFirmwareProfile,
  PidHardwareProfile,
  PidMatterProfile,
  PidUiProfile
} from "@jenix/device-schemas";

export type RootFieldUpdater = <K extends keyof CreatePidInput>(
  field: K,
  value: CreatePidInput[K]
) => void;

export type HardwareFieldUpdater = <K extends keyof PidHardwareProfile>(
  field: K,
  value: PidHardwareProfile[K]
) => void;

export type FirmwareFieldUpdater = <K extends keyof PidFirmwareProfile>(
  field: K,
  value: PidFirmwareProfile[K]
) => void;

export type MatterFieldUpdater = <K extends keyof PidMatterProfile>(
  field: K,
  value: PidMatterProfile[K]
) => void;

export type ApiFieldUpdater = <K extends keyof PidApiProfile>(
  field: K,
  value: PidApiProfile[K]
) => void;

export type UiFieldUpdater = <K extends keyof PidUiProfile>(
  field: K,
  value: PidUiProfile[K]
) => void;

export type DashboardFieldUpdater = <K extends keyof PidDashboardProfile>(
  field: K,
  value: PidDashboardProfile[K]
) => void;
