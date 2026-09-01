import { useState, useEffect } from "react";
import type { AuthSession } from "@jenix/shared";
import type { PrintTemplate } from "../types";
import * as api from "../services/tokenDispenserApi";

interface Props {
  session: AuthSession;
  deviceId: string;
  onClose: () => void;
}

export function TemplateEditorModal({ session, deviceId, onClose }: Props) {
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTemplate(session, deviceId)
      .then((t) => setJson(JSON.stringify(t, null, 2)))
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, [session, deviceId]);

  async function handleSave() {
    setError(null);
    let parsed: PrintTemplate;
    try {
      parsed = JSON.parse(json) as PrintTemplate;
    } catch {
      setError("Invalid JSON — check syntax before saving");
      return;
    }
    setSaving(true);
    try {
      await api.saveTemplate(session, deviceId, parsed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="td-modal-backdrop" onClick={onClose}>
      <div className="td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-actions">
          <h3 style={{ margin: 0 }}>Print Template Editor</h3>
          <button className="text-button" onClick={onClose}>✕ Close</button>
        </div>

        <p className="hint-text" style={{ margin: 0 }}>
          Variables: {"{{token_number}}"}, {"{{date_time}}"}, {"{{queue_name}}"},
          {"{{site_name}}"}, {"{{qr_payload}}"}
        </p>

        {loading ? (
          <p className="hint-text">Loading template...</p>
        ) : (
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={14}
            spellCheck={false}
            style={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              border: "1px solid #cbd5e1",
              borderRadius: "12px",
              padding: "10px 12px",
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box"
            }}
          />
        )}

        {error && <p className="inline-error" style={{ margin: 0 }}>{error}</p>}

        <div className="button-row">
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
