export interface StatusPillProps {
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

const toneStyles: Record<StatusPillProps["tone"], { background: string; color: string }> = {
  neutral: {
    background: "#eef1f6",
    color: "#16233f"
  },
  success: {
    background: "rgba(47, 184, 126, 0.14)",
    color: "#1f6e4d"
  },
  warning: {
    background: "rgba(245, 166, 35, 0.16)",
    color: "#8a5a12"
  },
  danger: {
    background: "rgba(235, 87, 87, 0.12)",
    color: "#b23636"
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
