import type { TokenDispenserState } from "../types";

interface Props {
  state: TokenDispenserState;
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ${min % 60}m ago`;
}

export function TokenStatusCard({ state }: Props) {
  const isPrinting = state.printStatus === "PRINTING";

  return (
    <div className="td-token-pair" style={{ gridColumn: "1 / -1" }}>
      {/* Current Token */}
      <article className="scene-card td-token-card">
        <p className="scene-card-kicker">Current Token</p>
        <div className={`td-token-number${isPrinting ? " td-token-printing" : ""}`}>
          {state.currentToken || "—"}
        </div>
        {isPrinting ? (
          <div className="td-printing-badge">⚙ Printing...</div>
        ) : (
          <p className="hint-text">
            {state.online ? "Ready to print" : "Device offline"}
          </p>
        )}
      </article>

      {/* Last Printed */}
      <article className="scene-card td-token-card">
        <p className="scene-card-kicker">Last Printed</p>
        <div className="td-token-number td-token-last">
          {state.lastPrintedToken || "—"}
        </div>
        <p className="hint-text">{relativeTime(state.lastPrintedAt)}</p>
        {state.lastPrintedToken && (
          <div className="td-receipt-stub">
            <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {state.lastPrintedToken}
            </span>
            <span className="hint-text" style={{ fontSize: "0.75rem" }}>
              {state.deviceId}
            </span>
          </div>
        )}
      </article>
    </div>
  );
}
