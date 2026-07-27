import { Fragment, useState } from "react";

import type { UiPackageRecord } from "@jenix/shared";

import {
  deprecateUiPackageVersion,
  publishUiPackageVersion,
  rollbackUiPackage
} from "../services/uiPackageApi";
import { PackageStatusPill, VersionStatusPill } from "./PackageStatusPill";

export interface PackageRegistryTableProps {
  packages: UiPackageRecord[];
  onChanged: () => void | Promise<void>;
}

export function PackageRegistryTable({ packages, onChanged }: PackageRegistryTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function withPending(key: string, action: () => Promise<unknown>) {
    setPending(key);
    try {
      await action();
      await onChanged();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="table-scroll">
      <table className="registry-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Current version</th>
            <th>Bound PID</th>
            <th>Entry path</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {packages.map((record) => {
            const current =
              record.versions.find((entry) => entry.status === "published") ??
              record.versions[record.versions.length - 1];
            const isOpen = expanded === record.packageId;

            return (
              <Fragment key={record.packageId}>
                <tr
                  className="row-hover"
                  onClick={() =>
                    setExpanded(isOpen ? null : record.packageId)
                  }
                >
                  <td>
                    <div className="tname">{record.packageId}</div>
                    <div className="tsub">{record.displayName}</div>
                  </td>
                  <td className="mono">{current?.version ?? "—"}</td>
                  <td>
                    <span className="mono tsub" style={{ color: "var(--text)" }}>
                      {record.pid}
                    </span>
                  </td>
                  <td className="mono tsub">{current?.entryPath ?? "— not set —"}</td>
                  <td>
                    <PackageStatusPill record={record} />
                  </td>
                  <td>{isOpen ? "▾" : "▸"}</td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <div className="subpanel">
                        <h4>Version history</h4>
                        {[...record.versions].reverse().map((version) => {
                          const pendingKey = `${record.packageId}@${version.version}`;
                          const isPending = pending === pendingKey;

                          return (
                            <div className="vh-row" key={version.version}>
                              <span className="vv">{version.version}</span>
                              <span>
                                <VersionStatusPill status={version.status} />
                              </span>
                              <span className="vt">
                                {version.status === "published"
                                  ? `Published ${version.publishedAt ?? ""}`
                                  : version.status === "deprecated"
                                    ? `Superseded ${version.deprecatedAt ?? ""}`
                                    : `Drafted ${version.createdAt}`}{" "}
                                {version.integrity ? "" : "· unsigned"}
                              </span>
                              {version.status === "draft" ? (
                                <button
                                  type="button"
                                  className="primary-button btn-sm"
                                  disabled={isPending}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void withPending(pendingKey, () =>
                                      publishUiPackageVersion(
                                        record.packageId,
                                        version.version
                                      )
                                    );
                                  }}
                                >
                                  Publish
                                </button>
                              ) : null}
                              {version.status === "published" ? (
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  style={{
                                    border: "none",
                                    cursor: "pointer",
                                    borderRadius: 8
                                  }}
                                  disabled={isPending}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void withPending(pendingKey, () =>
                                      deprecateUiPackageVersion(
                                        record.packageId,
                                        version.version
                                      )
                                    );
                                  }}
                                >
                                  Deprecate
                                </button>
                              ) : null}
                              {version.status === "deprecated" ? (
                                <button
                                  type="button"
                                  className="secondary-button btn-sm"
                                  disabled={isPending}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void withPending(pendingKey, () =>
                                      rollbackUiPackage(
                                        record.packageId,
                                        version.version
                                      )
                                    );
                                  }}
                                >
                                  Rollback
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
