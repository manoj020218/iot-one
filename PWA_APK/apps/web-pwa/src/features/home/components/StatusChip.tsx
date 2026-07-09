export type DeviceStatus = "online" | "offline" | "alert";

export interface StatusChipProps {
  status: DeviceStatus;
  label?: string;
}

const DEFAULT_LABEL: Record<DeviceStatus, string> = {
  online: "Live",
  offline: "Offline",
  alert: "Low level"
};

export function StatusChip({ status, label }: StatusChipProps) {
  return (
    <span className={`jx-chip ${status}`}>
      <span className="p" />
      {label ?? DEFAULT_LABEL[status]}
    </span>
  );
}
