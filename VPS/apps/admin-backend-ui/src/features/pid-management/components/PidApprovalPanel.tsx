import type { ProductPidRecord } from "@jenix/device-schemas";
import { Link } from "react-router-dom";

import { PidStatusPill } from "./PidStatusPill";

export interface PidApprovalPanelProps {
  record: ProductPidRecord;
  onApprove: () => Promise<void>;
  onArchive: () => Promise<void>;
}

export function PidApprovalPanel({
  record,
  onApprove,
  onArchive
}: PidApprovalPanelProps) {
  const canApprove = !record.approvedAt && record.status !== "production";
  const canEdit = !record.approvedAt && record.status !== "production";

  return (
    <section className="admin-card">
      <div className="card-head">
        <div>
          <h2>Approval</h2>
          <p>{record.approvedAt ? "Production locked" : "Awaiting approval"}</p>
        </div>
        <PidStatusPill status={record.status} />
      </div>
      <p>Approved by: {record.approvedBy ?? "Not approved yet"}</p>
      <p>Approved at: {record.approvedAt ?? "Pending"}</p>
      <div className="card-actions">
        {canEdit ? (
          <Link to={`/admin/developer/pid-management/${record.pid}/edit`}>
            Edit Draft
          </Link>
        ) : null}
        {canApprove ? (
          <button type="button" className="primary-button" onClick={() => void onApprove()}>
            Approve PID
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={() => void onArchive()}>
          Archive PID
        </button>
      </div>
    </section>
  );
}
