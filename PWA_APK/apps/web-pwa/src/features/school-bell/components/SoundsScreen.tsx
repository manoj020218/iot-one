import type { HomeAccessRole } from "@jenix/shared";
import { useEffect, useRef, useState } from "react";
import { FiUpload } from "react-icons/fi";

import { deleteSound, getPresets, getSounds, previewUrl, ringBell, uploadSound } from "../services/schoolBellLocalApi";
import { canManageSchedule, canRingBell } from "../services/schoolBellRoles";
import type { BellPreset, SchedulePack, Sound } from "../services/schoolBellTypes";
import { formatBytes } from "../services/formatBytes";
import { useBellLibrary } from "../services/useBellLibrary";
import { useBitrateWarning } from "../services/useBitrateWarning";
import { BellLibrarySection } from "./BellLibrarySection";
import { SoundRow } from "./SoundRow";

export interface SoundsScreenProps {
  role: HomeAccessRole;
  deviceId: string;
  baseUrl: string | null;
  pack: SchedulePack | null;
  /** From the device's own /status, polled by useDeviceClock in the shell — passed down rather than re-fetched here. */
  freeBytes: number | null;
}

function countUsage(pack: SchedulePack | null, soundId: string): number {
  if (!pack) return 0;
  return pack.profiles.reduce((total, profile) => total + profile.schedules.filter((s) => s.sound_id === soundId).length, 0);
}

/** The festival slot has its own dedicated screen (FestivalScreen) — keep it out of the general library list. */
function isLibrarySound(sound: Sound): boolean {
  return sound.source !== "festival-slot";
}

export function SoundsScreen({ role, deviceId, baseUrl, pack, freeBytes }: SoundsScreenProps) {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [presets, setPresets] = useState<BellPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManage = canManageSchedule(role) && Boolean(baseUrl);
  const library = useBellLibrary(deviceId, baseUrl);
  const bitrateWarning = useBitrateWarning();
  const librarySounds = sounds.filter(isLibrarySound);

  function reload() {
    if (!baseUrl) return;
    setLoading(true);
    Promise.all([getSounds(baseUrl), getPresets(baseUrl)])
      .then(([soundsResult, presetsResult]) => {
        setSounds(soundsResult.sounds);
        setPresets(presetsResult.presets);
      })
      .finally(() => setLoading(false));
  }

  useEffect(reload, [baseUrl]);

  async function handleUpload(file: File) {
    if (!baseUrl) return;
    void bitrateWarning.check(file);
    setUploading(true);
    try {
      await uploadSound(baseUrl, file.name, file);
      reload();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fileName: string) {
    if (!baseUrl) return;
    await deleteSound(baseUrl, fileName);
    reload();
  }

  return (
    <div className="sb-page">
      <div className="sb-head">
        <div className="hi">
          <h1>Sounds</h1>
          <p>{freeBytes !== null ? `${formatBytes(freeBytes)} free · internal library` : "Internal library, plus SD card if one's inserted"}</p>
        </div>
        <div className="sp" />
        {canManage ? (
          <button className="sb-iconbtn" onClick={() => fileInputRef.current?.click()} title="Upload" type="button">
            {uploading ? "…" : <FiUpload size={15} />}
          </button>
        ) : null}
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

      {bitrateWarning.warning ? <div className="sb-info">{bitrateWarning.warning}</div> : null}

      {presets.length > 0 ? (
        <>
          <div className="sb-sec">
            <h3>Quick presets</h3>
          </div>
          <div className="sb-card">
            {presets.map((preset) => (
              <div className="sb-row" key={preset.id}>
                <div className="body">
                  <div className="t">{preset.label}</div>
                  <div className="s">
                    {preset.sound_id} · {preset.duration}s
                  </div>
                </div>
                <div className="r">
                  <button
                    className="sb-btn ghost"
                    disabled={!baseUrl || !canRingBell(role)}
                    onClick={() => {
                      if (baseUrl) void ringBell(baseUrl, { name: preset.label, soundId: preset.sound_id, duration: preset.duration });
                    }}
                    style={{ width: "auto", padding: "0 12px" }}
                    type="button"
                  >
                    Ring
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="sb-sec">
        <h3>Sound library · {librarySounds.length} files</h3>
      </div>
      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : librarySounds.length === 0 ? (
        <div className="sb-empty">No sounds yet — upload one or push one from your saved library below.</div>
      ) : (
        <div className="sb-card">
          {librarySounds.map((sound) => (
            <SoundRow
              canDelete={canManage}
              key={sound.id}
              onDelete={() => handleDelete(sound.id)}
              previewSrc={baseUrl ? previewUrl(baseUrl, sound) : null}
              sound={sound}
              usedByCount={countUsage(pack, sound.id)}
            />
          ))}
        </div>
      )}

      <BellLibrarySection canManage={canManage} library={library} onPushed={reload} />
    </div>
  );
}
