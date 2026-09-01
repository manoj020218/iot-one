import { useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";
import type { TokenDispenserLog } from "../types";
import * as api from "../services/tokenDispenserApi";

interface Props {
  session: AuthSession;
  deviceId: string;
  onClose: () => void;
}

const LEVEL_COLOR: Record<string, string> = {
  info: "#16a34a",
  warn: "#d97706",
  error: "#dc2626",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

export function TokenLogsPanel({ session, deviceId, onClose }: Props) {
  const [logs, setLogs] = useState<TokenDispenserLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getLogs(session, deviceId)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [session, deviceId]);

  return (
    <div className="td-modal-backdrop" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions">
          <h3 style={{ margin: 0 }}>Audit Logs</h3>
          <button className="text-button" onClick={onClose}>Close</button>
        </div>

        {loading && <p className="hint-text">Loading logs...</p>}
        {error && <p className="inline-error" style={{ margin: 0 }}>{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="hint-text">No logs yet.</p>
        )}

        <div className="td-log-list">
          {logs.map((log) => (
            <div key={log.id} className="td-log-entry">
              <div className="td-log-head">
                <span
                  className="status-chip"
                  style={{
                    color: LEVEL_COLOR[log.level],
                    background: `${LEVEL_COLOR[log.level]}18`,
                  }}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="status-chip">{log.source}</span>
                <span className="hint-text" style={{ fontSize: "0.78rem" }}>
                  {fmt(log.timestamp)}
                </span>
              </div>

              <strong style={{ fontSize: "0.9rem" }}>{log.action}</strong>

              {(log.oldValue ?? log.newValue) && (
                <p className="hint-text" style={{ margin: 0 }}>
                  {log.oldValue && `From: ${log.oldValue}`}
                  {log.oldValue && log.newValue && " -> "}
                  {log.newValue && `To: ${log.newValue}`}
                </p>
              )}
              {log.eventSource && (
                <p className="hint-text" style={{ margin: 0, fontSize: "0.75rem" }}>
                  Via: {log.eventSource}
                </p>
              )}
              {log.deliveryId && (
                <p className="hint-text" style={{ margin: 0, fontSize: "0.75rem" }}>
                  Delivery: {log.deliveryId}
                </p>
              )}
              {log.details && (
                <p className="hint-text" style={{ margin: 0, fontSize: "0.75rem" }}>
                  {log.details}
                </p>
              )}
              {log.userId && (
                <p className="hint-text" style={{ margin: 0, fontSize: "0.75rem" }}>
                  By: {log.userId}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
