import { useEffect, useState } from "react";

import { Sheet } from "../../../app/components/Sheet";
import type { Holiday } from "../services/schoolBellTypes";

export interface AddHolidaySheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (holiday: Holiday) => void;
}

export function AddHolidaySheet({ open, onClose, onAdd }: AddHolidaySheetProps) {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setDate("");
      setName("");
    }
  }, [open]);

  return (
    <Sheet onClose={onClose} open={open} subtitle="Suppresses automatic bells that day — manual ring still works" title="Add holiday">
      <div className="sb-field">
        <label>Date</label>
        <input onChange={(event) => setDate(event.target.value)} placeholder="YYYY-MM-DD" type="text" value={date} />
      </div>
      <div className="sb-field">
        <label>Name</label>
        <input onChange={(event) => setName(event.target.value)} placeholder="Children's Day" type="text" value={name} />
      </div>
      <button
        className="sb-btn primary"
        disabled={!date.trim() || !name.trim()}
        onClick={() => onAdd({ date: date.trim(), name: name.trim(), type: "holiday" })}
        type="button"
      >
        Save holiday
      </button>
    </Sheet>
  );
}
