export type UiPackageVersionStatus = "draft" | "published" | "deprecated";

export interface UiPackageVersionRecord {
  version: string;
  manifestPath: string;
  entryPath: string;
  exportName: string;
  integrity?: string;
  status: UiPackageVersionStatus;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  deprecatedAt?: string;
}

export interface UiPackageRecord {
  packageId: string;
  pid: string;
  displayName: string;
  versions: UiPackageVersionRecord[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface CreateUiPackageInput {
  packageId: string;
  pid: string;
  displayName: string;
  version: string;
  manifestPath: string;
  entryPath: string;
  exportName: string;
  integrity?: string;
  publishImmediately?: boolean;
}

export interface AddUiPackageVersionInput {
  version: string;
  manifestPath: string;
  entryPath: string;
  exportName: string;
  integrity?: string;
  publishImmediately?: boolean;
}
