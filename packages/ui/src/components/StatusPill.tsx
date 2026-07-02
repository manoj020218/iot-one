export interface StatusPillProps {
  label: string;
  tone: "neutral" | "success" | "warning";
}

const toneStyles: Record<StatusPillProps["tone"], { background: string; color: string }> = {
  neutral: {
    background: "#e2e8f0",
    color: "#0f172a"
  },
  success: {
    background: "#dcfce7",
    color: "#166534"
  },
  warning: {
    background: "#fef3c7",
    color: "#92400e"
  }
};

export function StatusPill({ label, tone }: StatusPillProps) {
  const style = toneStyles[tone];

  return (
    <span
      data-status={tone}
      style={{
        alignItems: "center",
        background: style.background,
        borderRadius: 999,
        color: style.color,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        minHeight: 30,
        padding: "4px 12px"
      }}
    >
      {label}
    </span>
  );
}
