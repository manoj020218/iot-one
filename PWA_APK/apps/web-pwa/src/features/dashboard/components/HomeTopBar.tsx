import type { HomeRecord } from "@jenix/shared";

import { AddDeviceButton } from "./AddDeviceButton";

export interface HomeTopBarProps {
  home: HomeRecord;
  userName: string;
  onAddDevice?: () => void;
}

export function HomeTopBar({
  home,
  userName,
  onAddDevice
}: HomeTopBarProps) {
  return (
    <section className="top-bar">
      <div>
        <span className="eyebrow">Current Home</span>
        <h2>{home.name}</h2>
      </div>
      <div className="top-bar-meta">
        <span>{userName}</span>
        <span>Provision-ready</span>
        {onAddDevice ? (
          <AddDeviceButton label="+ Provision Device" onPress={onAddDevice} />
        ) : null}
      </div>
    </section>
  );
}
