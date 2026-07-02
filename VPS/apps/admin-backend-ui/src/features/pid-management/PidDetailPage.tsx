import { useParams } from "react-router-dom";

import { PidApprovalPanel } from "./components/PidApprovalPanel";
import { PidDetailSummary } from "./components/PidDetailSummary";
import { PidPageShell } from "./components/PidPageShell";
import { usePidRecord } from "./hooks/usePidRecord";
import { approvePid, archivePid } from "./services/pidApi";

export function PidDetailPage() {
  const { pid } = useParams();
  const { record, loading, error, reload } = usePidRecord(pid);

  async function handleApprove() {
    if (!pid) {
      return;
    }

    await approvePid(pid);
    await reload();
  }

  async function handleArchive() {
    if (!pid) {
      return;
    }

    await archivePid(pid);
    await reload();
  }

  return (
    <PidPageShell
      title={`PID Detail ${pid ?? ""}`}
      description="Review the product identity, hardware, firmware, and dashboard ownership before release approval."
    >
      {loading ? <section className="admin-card">Loading PID details...</section> : null}
      {error ? <section className="validation-card">{error}</section> : null}
      {record ? (
        <>
          <PidDetailSummary record={record} />
          <PidApprovalPanel
            record={record}
            onApprove={handleApprove}
            onArchive={handleArchive}
          />
        </>
      ) : null}
    </PidPageShell>
  );
}
