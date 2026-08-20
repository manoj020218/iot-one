import type { ReactNode } from "react";

import "./deviceTimerPanel.css";

/**
 * Shared 5-segment Timer shell (Countdown / Schedule / Circulate / Random
 * / Inching) for any device's control screen — same pattern Tuya uses
 * across its whole product line. Built for QRunlock first (see
 * features/qrunlock/QrunlockDevicePage.tsx) but deliberately holds no
 * QRunlock-specific logic: a future device supplies its own `panels` map
 * and gets the identical segmented chrome for free. A mode a device
 * doesn't support yet can simply be omitted from `panels` — it falls back
 * to <ComingSoonPanel />.
 */
export type DeviceTimerMode = "countdown" | "schedule" | "circulate" | "random" | "inching";

const MODE_ORDER: DeviceTimerMode[] = ["countdown", "schedule", "circulate", "random", "inching"];
const MODE_LABEL: Record<DeviceTimerMode, string> = {
  countdown: "Countdown",
  schedule: "Schedule",
  circulate: "Circulate",
  random: "Random",
  inching: "Inching"
};

export interface DeviceTimerPanelProps {
  active: DeviceTimerMode;
  onChange: (mode: DeviceTimerMode) => void;
  panels: Partial<Record<DeviceTimerMode, ReactNode>>;
}

export function DeviceTimerPanel({ active, onChange, panels }: DeviceTimerPanelProps) {
  return (
    <div className="dev-timer">
      <div className="dev-timer-seg">
        {MODE_ORDER.map((mode) => (
          <button
            className={active === mode ? "on" : ""}
            key={mode}
            onClick={() => onChange(mode)}
            type="button"
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
      <div className="dev-timer-body">{panels[active] ?? <ComingSoonPanel feature={MODE_LABEL[active]} />}</div>
    </div>
  );
}

export function ComingSoonPanel({ feature }: { feature: string }) {
  return (
    <div className="dev-timer-card dev-timer-coming-soon">
      <div className="dev-timer-coming-soon-title">{feature} isn&apos;t available on this device yet</div>
      <p>This mode needs backend scheduling support that hasn&apos;t been built for this product yet.</p>
    </div>
  );
}
