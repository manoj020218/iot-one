export type UiPackageMode = "builtin" | "remote-package";

export interface HomeUiBootstrapPackageRecord {
  packageId: string;
  version: string;
  manifestPath: string;
  entryPath: string;
  exportName: string;
  integrity?: string;
}

export interface HomeUiBootstrapPidBinding {
  pid: string;
  productName: string;
  templateId: string;
  dynamicPages: string[];
  icon?: string;
  cardLayout?: string;
  uiMode: UiPackageMode;
  uiPackageId?: string;
  uiPackageVersion?: string;
  packageKey?: string;
}

export interface HomeUiBootstrapDeviceBinding {
  deviceId: string;
  pid: string;
  displayName: string;
  homeId: string;
  online: boolean;
  templateId: string;
  dynamicPages: string[];
  uiMode: UiPackageMode;
  uiPackageId?: string;
  uiPackageVersion?: string;
  packageKey?: string;
}

export interface HomeUiBootstrapResponse {
  homeId: string;
  generatedAt: string;
  devices: HomeUiBootstrapDeviceBinding[];
  pidBindings: HomeUiBootstrapPidBinding[];
  packages: HomeUiBootstrapPackageRecord[];
}

export function createUiPackageKey(
  packageId: string,
  version: string
): string {
  return `${packageId}@${version}`;
}
