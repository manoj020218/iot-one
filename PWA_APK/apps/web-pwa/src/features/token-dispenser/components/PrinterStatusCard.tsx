import type { TokenDispenserState, PrinterStatus } from "../types";

const STATUS: Record<PrinterStatus, { label: string; color: string; bg: string; icon: string }> = {
  IDLE:      { label: "Ready",        color: "#16a34a", bg: "rgba(220,252,231,0.85)", icon: "✓" },
  PRINTING:  { label: "Printing",     color: "#0f766e", bg: "rgba(204,251,241,0.85)", icon: "⚙" },
  PAPER_LOW: { label: "Paper Low",    color: "#d97706", bg: "rgba(254,243,199,0.85)", icon: "⚠" },
  PAPER_OUT: { label: "Paper Out",    color: "#dc2626", bg: "rgba(254,226,226,0.85)", icon: "✕" },
  OFFLINE:   { label: "Offline",      color: "#64748b", bg: "rgba(226,232,240,0.85)", icon: "○" },
  ERROR:     { label: "Error",        color: "#dc2626", bg: "rgba(254,226,226,0.85)", icon: "!" },
  OVERHEAT:  { label: "Overheat",     color: "#ea580c", bg: "rgba(255,237,213,0.85)", icon: "♨" }
};

interface Props {
  state: TokenDispenserState;
}

export function PrinterStatusCard({ state }: Props) {
  const cfg = STATUS[state.printerStatus] ?? STATUS.OFFLINE;

  return (
    <article
      className="scene-card"
      style={{ background: cfg.bg, borderColor: `${cfg.color}30` }}
    >
      <p className="scene-card-kicker">Printer Status</p>

      <div className="td-status-display">
        <span className="td-status-icon" style={{ color: cfg.color }}>{cfg.icon}</span>
        <h3 style={{ margin: 0, color: cfg.color }}>{cfg.label}</h3>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>Print Queue</dt>
          <dd>{state.printStatus}</dd>
        </div>
        <div>
          <dt>Paper</dt>
          <dd style={{ color: state.paperLow ? "#dc2626" : "#16a34a" }}>
            {state.paperLow ? "Low" : "OK"}
          </dd>
        </div>
      </dl>

      {state.lastError && (
        <p className="inline-error" style={{ margin: 0 }}>
          Last error: {state.lastError}
        </p>
      )}
    </article>
  );
}
