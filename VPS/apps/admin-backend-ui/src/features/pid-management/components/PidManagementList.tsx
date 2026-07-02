import type { ProductPidRecord } from "@jenix/device-schemas";
import { Link } from "react-router-dom";

import { PidStatusPill } from "./PidStatusPill";

export interface PidManagementListProps {
  pids: ProductPidRecord[];
}

export function PidManagementList({ pids }: PidManagementListProps) {
  return (
    <section className="list-grid">
      {pids.map((pid) => (
        <article key={pid.pid} className="admin-card">
          <div className="card-head">
            <div>
              <h2>{pid.productName}</h2>
              <p>{pid.pid}</p>
            </div>
            <PidStatusPill status={pid.status} />
          </div>
          <p>
            {pid.productCategory} / {pid.productLine}
          </p>
          <p>Firmware: {pid.firmware.firmwareFamily}</p>
          <div className="card-actions">
            <Link to={`/admin/developer/pid-management/${pid.pid}`}>View</Link>
            <Link to={`/admin/developer/pid-management/${pid.pid}/edit`}>
              Edit
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
