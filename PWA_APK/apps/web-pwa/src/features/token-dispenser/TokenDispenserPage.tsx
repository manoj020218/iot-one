import { useCallback, useEffect, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import { DeviceHealthCard } from "./components/DeviceHealthCard";
import { PaperRollCard } from "./components/PaperRollCard";
import { PrinterStatusCard } from "./components/PrinterStatusCard";
import { SceneLinkPanel } from "./components/SceneLinkPanel";
import { TemplateEditorModal } from "./components/TemplateEditorModal";
import { TokenActionPanel } from "./components/TokenActionPanel";
import { TokenLogsPanel } from "./components/TokenLogsPanel";
import { TokenStatusCard } from "./components/TokenStatusCard";
import "./token-dispenser.css";
import { getStatus, resetRoll } from "./services/tokenDispenserApi";
import type { TokenDispenserState } from "./types";

export interface TokenDispenserPageProps {
  session: AuthSession;
  deviceId: string;
  onDeviceListRequested?: () => void;
}

export function TokenDispenserPage({ session, deviceId }: TokenDispenserPageProps) {
  const [tdState, setTdState] = useState<TokenDispenserState | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getStatus(session, deviceId);
      setTdState(s);
    } finally {
      setLoading(false);
    }
  }, [session, deviceId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function handleRollReset() {
    setResetting(true);
    try {
      await resetRoll(session, deviceId);
      await refresh();
    } finally {
      setResetting(false);
    }
  }

  if (loading || !tdState) {
    return (
      <article className="scene-card" style={{ gridColumn: "1 / -1" }}>
        <p className="hint-text">Loading token dispenser...</p>
      </article>
    );
  }

  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="content-grid">
        <TokenStatusCard state={tdState} />

        <PaperRollCard state={tdState} onRollReset={handleRollReset} resetting={resetting} />
        <PrinterStatusCard state={tdState} />
        <DeviceHealthCard state={tdState} />
        <TokenActionPanel
          session={session}
          deviceId={deviceId}
          onAction={refresh}
          onOpenTemplate={() => setShowTemplate(true)}
          onOpenLogs={() => setShowLogs(true)}
        />

        <div style={{ gridColumn: "1 / -1" }}>
          <SceneLinkPanel deviceId={deviceId} />
        </div>
      </div>

      {showTemplate && (
        <TemplateEditorModal
          session={session}
          deviceId={deviceId}
          onClose={() => setShowTemplate(false)}
        />
      )}
      {showLogs && (
        <TokenLogsPanel session={session} deviceId={deviceId} onClose={() => setShowLogs(false)} />
      )}
    </div>
  );
}
