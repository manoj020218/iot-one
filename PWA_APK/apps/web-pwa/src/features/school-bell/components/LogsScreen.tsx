import type { HomeAccessRole } from "@jenix/shared";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiTrash2 } from "react-icons/fi";

import { clearLogs, getLogs } from "../services/schoolBellLocalApi";
import { canManageDangerZone } from "../services/schoolBellRoles";

export interface LogsScreenProps {
  role: HomeAccessRole;
  baseUrl: string | null;
  onBack: () => void;
}

export function LogsScreen({ role, baseUrl, onBack }: LogsScreenProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const canClear = canManageDangerZone(role) && Boolean(baseUrl);

  function reload() {
    if (!baseUrl) return;
    setLoading(true);
    getLogs(baseUrl)
      .then((result) => setLogs(result.logs))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [baseUrl]);

  async function handleClear() {
    if (!baseUrl) return;
    await clearLogs(baseUrl);
    setLogs([]);
  }

  return (
    <div className="sb-page">
      <div className="sb-back">
        <button className="sb-iconbtn" onClick={onBack} type="button">
          <FiArrowLeft size={15} />
        </button>
        <h2>Activity log</h2>
        <div className="sp" />
        {canClear ? (
          <button className="sb-iconbtn" onClick={handleClear} title="Clear" type="button">
            <FiTrash2 size={14} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="sb-empty">No activity recorded yet.</div>
      ) : (
        <div className="sb-card">
          {logs.map((line, index) => (
            <div className="sb-row" key={index}>
              <div className="body">
                <div className="t">{line}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
