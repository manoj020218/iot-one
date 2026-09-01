import { useState } from "react";
import type { AuthSession } from "@jenix/shared";
import * as api from "../services/tokenDispenserApi";

interface Props {
  session: AuthSession;
  deviceId: string;
  onAction: () => void;
  onOpenTemplate: () => void;
  onOpenLogs: () => void;
}

export function TokenActionPanel({
  session, deviceId, onAction, onOpenTemplate, onOpenLogs
}: Props) {
  const [counterVal, setCounterVal] = useState("");
  const [prefixVal, setPrefixVal] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      onAction();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Command failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="scene-card">
      <p className="scene-card-kicker">Actions</p>

      {error && <p className="inline-error" style={{ margin: 0 }}>{error}</p>}

      <div className="button-row">
        <button
          className="primary-button"
          disabled={busy !== null}
          onClick={() => run("print", () => api.printNext(session, deviceId))}
        >
          {busy === "print" ? "Sending..." : "Print Next Token"}
        </button>
        <button
          className="secondary-button"
          disabled={busy !== null}
          onClick={() => run("test", () => api.testPrint(session, deviceId))}
        >
          {busy === "test" ? "Sending..." : "Test Print"}
        </button>
      </div>

      <div className="field">
        <label>Set Token Counter</label>
        <div className="button-row">
          <input
            type="number"
            min={0}
            value={counterVal}
            onChange={(e) => setCounterVal(e.target.value)}
            placeholder="e.g. 100"
            style={{ flex: 1 }}
          />
          <button
            className="secondary-button"
            disabled={busy !== null || !counterVal}
            onClick={() =>
              run("counter", () => api.setCounter(session, deviceId, Number(counterVal)))
            }
          >
            Set
          </button>
        </div>
      </div>

      <div className="field">
        <label>Set Token Prefix</label>
        <div className="button-row">
          <input
            type="text"
            maxLength={4}
            value={prefixVal}
            onChange={(e) => setPrefixVal(e.target.value.toUpperCase())}
            placeholder="e.g. A"
            style={{ flex: 1 }}
          />
          <button
            className="secondary-button"
            disabled={busy !== null || !prefixVal}
            onClick={() =>
              run("prefix", () => api.setPrefix(session, deviceId, prefixVal))
            }
          >
            Set
          </button>
        </div>
      </div>

      <div className="button-row">
        <button className="text-button" onClick={onOpenTemplate}>
          Edit Print Template
        </button>
        <button className="text-button" onClick={onOpenLogs}>
          View Audit Logs
        </button>
      </div>
    </article>
  );
}
