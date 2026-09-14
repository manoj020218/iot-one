import { useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import { formatSdCard } from "../services/schoolBellLocalApi";

export interface FormatSdSheetProps {
  open: boolean;
  onClose: () => void;
  baseUrl: string | null;
}

export function FormatSdSheet({ open, onClose, baseUrl }: FormatSdSheetProps) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleFormat() {
    if (!baseUrl || confirmText !== "FORMAT") return;
    setBusy(true);
    try {
      await formatSdCard(baseUrl);
      onClose();
    } finally {
      setBusy(false);
      setConfirmText("");
    }
  }

  return (
    <Sheet onClose={onClose} open={open} subtitle="Erases every sound, schedule and log on this device. Cannot be undone." title="Format SD card">
      <div className="sb-field">
        <label>Type FORMAT to confirm</label>
        <input onChange={(event) => setConfirmText(event.target.value)} type="text" value={confirmText} />
      </div>
      <button className="sb-btn danger" disabled={confirmText !== "FORMAT" || busy} onClick={handleFormat} type="button">
        {busy ? "Formatting…" : "Format SD card"}
      </button>
    </Sheet>
  );
}
