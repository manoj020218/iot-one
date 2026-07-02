import { StatusPill } from "@jenix/ui";
import { Link } from "react-router-dom";

import { PidManagementList } from "./components/PidManagementList";
import { PidPageShell } from "./components/PidPageShell";
import { usePidCollection } from "./hooks/usePidCollection";

export function PidManagementPage() {
  const { pids, loading, error } = usePidCollection();

  return (
    <PidPageShell
      title="PID Catalog"
      description="Developer-only product identity management with approval discipline, Matter readiness, and dashboard template ownership."
      aside={<StatusPill label={`${pids.length} PID(s)`} tone="neutral" />}
    >
      <section className="toolbar-card">
        <div>
          <h2>Developer Route</h2>
          <p>/admin/developer/pid-management</p>
        </div>
        <Link className="primary-link" to="/admin/developer/pid-management/new">
          Create New PID
        </Link>
      </section>

      {loading ? <section className="admin-card">Loading PID catalog...</section> : null}
      {error ? <section className="validation-card">{error}</section> : null}
      {!loading && !error ? <PidManagementList pids={pids} /> : null}
    </PidPageShell>
  );
}
