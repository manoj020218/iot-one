import type { HomeRecord } from "@jenix/shared";

import { Sheet } from "../../../app/components/Sheet";

export interface HomeSelectorSheetProps {
  currentHomeId?: string;
  homes: HomeRecord[];
  onClose: () => void;
  onCreate: () => void;
  onSelect: (homeId: string) => void;
  open: boolean;
}

export function HomeSelectorSheet({
  currentHomeId,
  homes,
  onClose,
  onCreate,
  onSelect,
  open
}: HomeSelectorSheetProps) {
  return (
    <Sheet
      open={open}
      title="Select Home"
      subtitle="Switch the active home to filter devices and automations."
      onClose={onClose}
    >
      <div className="home-selector-list">
        {homes.map((home) => (
          <button
            className="home-selector-card"
            data-active={home.homeId === currentHomeId}
            key={home.homeId}
            onClick={() => {
              onSelect(home.homeId);
              onClose();
            }}
            type="button"
          >
            <div>
              <strong>{home.name}</strong>
              <span className="hint-text">
                {home.allowed === false ? "Not allowed" : `${home.role} access`}
              </span>
            </div>
            <span className="status-chip" data-status={home.allowed === false ? "failed" : "completed"}>
              {home.homeId === currentHomeId ? "Current" : "Open"}
            </span>
          </button>
        ))}
        <button className="secondary-button" onClick={onCreate} type="button">
          Create Home
        </button>
      </div>
    </Sheet>
  );
}
