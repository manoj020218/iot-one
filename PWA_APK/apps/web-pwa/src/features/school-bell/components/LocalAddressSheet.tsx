import { useEffect, useState } from "react";

import { Sheet } from "../../../app/components/Sheet";

export interface LocalAddressSheetProps {
  open: boolean;
  initialValue: string | null;
  onSave: (address: string) => void;
  onClose: () => void;
}

/**
 * Manual entry today because provisioning/discovery is deliberately out
 * of scope for this pass — the AP address (192.168.4.1) is the right
 * default while a bell is still in setup mode; once it joins school
 * Wi-Fi, whatever DHCP handed it needs to be entered here once. A future
 * provisioning flow can call the same onSave without this sheet changing.
 */
export function LocalAddressSheet({ open, initialValue, onSave, onClose }: LocalAddressSheetProps) {
  const [value, setValue] = useState(initialValue ?? "192.168.4.1");

  useEffect(() => {
    if (open) setValue(initialValue ?? "192.168.4.1");
  }, [open, initialValue]);

  return (
    <Sheet
      actions={
        <button className="sb-btn primary" onClick={() => onSave(value)} type="button">
          Save
        </button>
      }
      onClose={onClose}
      open={open}
      subtitle="The bell's IP address on school Wi-Fi, or 192.168.4.1 while it's still in setup mode"
      title="Local network address"
    >
      <div className="sb-field">
        <label>Address</label>
        <input onChange={(event) => setValue(event.target.value)} type="text" value={value} />
      </div>
    </Sheet>
  );
}
