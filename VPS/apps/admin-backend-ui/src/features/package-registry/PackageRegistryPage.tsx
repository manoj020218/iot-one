import { useState } from "react";

import { AdminConsoleShell } from "../../app/AdminConsoleShell";
import { usePidCollection } from "../pid-management/hooks/usePidCollection";

import { PackageRegistryTable } from "./components/PackageRegistryTable";
import { RegisterPackageDrawer } from "./components/RegisterPackageDrawer";
import { usePackageRegistry } from "./hooks/usePackageRegistry";

export function PackageRegistryPage() {
  const { packages, loading, error, reload } = usePackageRegistry();
  const { pids } = usePidCollection();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const publishedCount = packages.filter((record) =>
    record.versions.some((entry) => entry.status === "published")
  ).length;
  const draftCount = packages.filter(
    (record) => !record.versions.some((entry) => entry.status === "published")
  ).length;
  const unsignedCount = packages.filter(
    (record) => !record.versions.some((entry) => entry.integrity)
  ).length;

  return (
    <AdminConsoleShell
      title="Package Registry"
      description="Registry-backed UI package catalog — PID to package to remote entry, no source-code deploys to add a plugin."
    >
      <div className="kpirow">
        <div className="kpi">
          <div className="l">Registered packages</div>
          <div className="v">{packages.length}</div>
          <div className="d">across {new Set(packages.map((p) => p.pid)).size} PIDs</div>
        </div>
        <div className="kpi">
          <div className="l">Published</div>
          <div className="v accent">{publishedCount}</div>
          <div className="d">serving live devices</div>
        </div>
        <div className="kpi">
          <div className="l">Draft / unpublished</div>
          <div className="v">{draftCount}</div>
          <div className="d">registered, not yet live</div>
        </div>
        <div className="kpi">
          <div className="l">Unsigned artifacts</div>
          <div className="v crit">{unsignedCount}</div>
          <div className="d">no integrity hash on file</div>
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div>
            <h2>Registered packages</h2>
            <p>Click a row for version history, publish, deprecate, and rollback.</p>
          </div>
          <div className="spacer" />
          <button
            type="button"
            className="primary-button"
            onClick={() => setDrawerOpen(true)}
          >
            + Register package
          </button>
        </div>
        {loading ? <div style={{ padding: 18 }}>Loading package registry…</div> : null}
        {error ? <div className="validation-card">{error}</div> : null}
        {!loading && !error ? (
          <PackageRegistryTable packages={packages} onChanged={reload} />
        ) : null}
      </div>

      <RegisterPackageDrawer
        open={drawerOpen}
        pids={pids}
        onClose={() => setDrawerOpen(false)}
        onRegistered={reload}
      />
    </AdminConsoleShell>
  );
}
