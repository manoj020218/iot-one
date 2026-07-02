import type { ProductPidRecord } from "@jenix/device-schemas";

export interface PidDetailSummaryProps {
  record: ProductPidRecord;
}

export function PidDetailSummary({ record }: PidDetailSummaryProps) {
  return (
    <section className="detail-grid">
      <article className="admin-card">
        <h2>Identity</h2>
        <p>{record.pid}</p>
        <p>{record.productName}</p>
        <p>
          {record.productCategory} / {record.productLine}
        </p>
      </article>
      <article className="admin-card">
        <h2>Hardware</h2>
        <p>MCU: {record.hardware.mcu}</p>
        <p>Revision: {record.hardware.hardwareRevision}</p>
        <p>BLE: {record.hardware.hasBle ? "Yes" : "No"}</p>
      </article>
      <article className="admin-card">
        <h2>Firmware</h2>
        <p>Family: {record.firmware.firmwareFamily}</p>
        <p>Channel: {record.firmware.otaChannel}</p>
        <p>Stable: {record.firmware.stableVersion ?? "Pending"}</p>
      </article>
      <article className="admin-card">
        <h2>Dashboard</h2>
        <p>Template: {record.dashboard.templateId}</p>
        <p>Pages: {record.dashboard.dynamicPages.join(", ") || "None"}</p>
      </article>
    </section>
  );
}
