import type { HomeAccessRole } from "@jenix/shared";
import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiPlay, FiTrash2, FiUpload } from "react-icons/fi";

import { clearFestival, getFestival, previewUrl, ringBell, uploadFestival } from "../services/schoolBellLocalApi";
import { LocalApiError } from "../services/schoolBellLocalHttp";
import { formatBytes } from "../services/formatBytes";
import { canManageSchedule, canRingBell } from "../services/schoolBellRoles";
import type { FestivalSlot } from "../services/schoolBellTypes";

export interface FestivalScreenProps {
  role: HomeAccessRole;
  baseUrl: string | null;
  onBack: () => void;
}

const FESTIVAL_SOUND_ID = "festival/current";

/**
 * The one-off HiFi/event track slot (FIRMWARE_TASKS_APK_INTEGRATION.md
 * Task 2) — deliberately not a backup/restore of the normal library,
 * just one replaceable file the device guards against deletion while a
 * schedule still points at it (409 from clearFestival).
 */
export function FestivalScreen({ role, baseUrl, onBack }: FestivalScreenProps) {
  const [slot, setSlot] = useState<FestivalSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManage = canManageSchedule(role) && Boolean(baseUrl);

  function reload() {
    if (!baseUrl) return;
    setLoading(true);
    getFestival(baseUrl)
      .then(setSlot)
      .finally(() => setLoading(false));
  }

  useEffect(reload, [baseUrl]);

  async function handleUpload(file: File) {
    if (!baseUrl) return;
    setBusy(true);
    setError(null);
    try {
      await uploadFestival(baseUrl, file.name, file);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    if (!baseUrl) return;
    setBusy(true);
    setError(null);
    try {
      await clearFestival(baseUrl);
      reload();
    } catch (err) {
      setError(
        err instanceof LocalApiError && err.status === 409
          ? "This track is still attached to a schedule — remove that bell first, then clear it here."
          : "Could not clear the festival track."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sb-page">
      <div className="sb-back">
        <button className="sb-iconbtn" onClick={onBack} type="button">
          <FiArrowLeft size={15} />
        </button>
        <h2>Festival track</h2>
      </div>

      <div className="sb-info" style={{ marginBottom: 16 }}>
        One replaceable slot for a one-off event track — a purchased or self-hosted file you own, not something pulled from a
        streaming service. Ring it manually or attach it to a single schedule entry, then clear it when the event's over.
      </div>

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : slot?.file ? (
        <div className="sb-card">
          <div className="sb-row">
            <button className="sb-iconbtn" onClick={() => window.open(baseUrl ? previewUrl(baseUrl, slot.file!) : "#", "_blank")} type="button">
              <FiPlay size={14} />
            </button>
            <div className="body">
              <div className="t">{slot.file.name}</div>
              <div className="s">
                {slot.file.format.toUpperCase()} · {formatBytes(slot.file.bytes)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="sb-empty">No festival track set.</div>
      )}

      {error ? <p style={{ color: "var(--danger)", fontSize: 12.5 }}>{error}</p> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {canManage ? (
          <button className="sb-btn ghost" disabled={busy} onClick={() => fileInputRef.current?.click()} type="button">
            <FiUpload size={15} /> {slot?.file ? "Replace track" : "Upload track"}
          </button>
        ) : null}
        {slot?.file ? (
          <button
            className="sb-btn primary"
            disabled={!baseUrl || !canRingBell(role)}
            onClick={() => baseUrl && void ringBell(baseUrl, { name: "Festival", soundId: FESTIVAL_SOUND_ID, duration: 60 })}
            type="button"
          >
            Ring now
          </button>
        ) : null}
        {canManage && slot?.file ? (
          <button className="sb-btn ghost" disabled={busy} onClick={handleClear} style={{ color: "var(--danger)" }} type="button">
            <FiTrash2 size={15} /> Clear festival track
          </button>
        ) : null}
      </div>

      <input
        accept="audio/mpeg,audio/wav"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleUpload(file);
          event.target.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
