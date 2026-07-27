import type { UiPackageRecord, UiPackageVersionStatus } from "@jenix/shared";

function derivePackageStatus(record: UiPackageRecord): UiPackageVersionStatus {
  if (record.versions.some((entry) => entry.status === "published")) {
    return "published";
  }

  if (record.versions.some((entry) => entry.status === "draft")) {
    return "draft";
  }

  return "deprecated";
}

const pillClassByStatus: Record<UiPackageVersionStatus, string> = {
  published: "pill pill-ok",
  draft: "pill pill-info",
  deprecated: "pill pill-idle"
};

const labelByStatus: Record<UiPackageVersionStatus, string> = {
  published: "Published",
  draft: "Draft",
  deprecated: "Deprecated"
};

export interface PackageStatusPillProps {
  record: UiPackageRecord;
}

export function PackageStatusPill({ record }: PackageStatusPillProps) {
  const status = derivePackageStatus(record);
  return <span className={pillClassByStatus[status]}>{labelByStatus[status]}</span>;
}

export interface VersionStatusPillProps {
  status: UiPackageVersionStatus;
}

export function VersionStatusPill({ status }: VersionStatusPillProps) {
  return <span className={pillClassByStatus[status]}>{labelByStatus[status]}</span>;
}
