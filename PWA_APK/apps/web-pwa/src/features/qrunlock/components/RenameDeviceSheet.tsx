import { useEffect, useState } from "react";

export interface RenameDeviceSheetProps {
  open: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
}

export function RenameDeviceSheet({ open, currentName, onClose, onSave }: RenameDeviceSheetProps) {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    onClose();
  }

  return (
    <>
      <div className={`qr-scrim ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`qr-sheet ${open ? "open" : ""}`}>
        <div className="grab" />
        <div className="sh-title">Rename Device</div>
        <div style={{ padding: "4px 18px 18px" }}>
          <input
            className="qr-sheet-input"
            maxLength={40}
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
          <button className="qr-btn primary block" onClick={() => void handleSave()} style={{ marginTop: 14 }} type="button">
            Save
          </button>
        </div>
      </div>
    </>
  );
}
