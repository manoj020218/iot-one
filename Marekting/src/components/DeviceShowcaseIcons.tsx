import type { DeviceCategory } from "../content/deviceShowcaseContent";

const iconProps = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export function TankGuardIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="15" y="9" width="18" height="30" rx="5" />
      <path d="M15 25c3 2 6-2 9 0s6-2 9 0" strokeWidth={1.4} />
      <line x1="19" y1="16" x2="29" y2="16" strokeWidth={1.3} />
      <path d="M35 13c2 1.4 2 4.2 0 5.6" strokeWidth={1.3} />
      <path d="M38.5 11c3.4 2.6 3.4 7.4 0 10" strokeWidth={1.3} />
    </svg>
  );
}

export function NurseCallIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M24 12a8 8 0 0 1 8 8v6l3 4H13l3-4v-6a8 8 0 0 1 8-8z" />
      <path d="M21 32a3 3 0 0 0 6 0" />
      <path d="M34 15c2.6 1.8 2.6 6.2 0 8" strokeWidth={1.3} />
      <path d="M37.5 12c4.2 3 4.2 9 0 12" strokeWidth={1.3} />
    </svg>
  );
}

export function RfBridgeIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <line x1="12" y1="32" x2="12" y2="18" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <path d="M16 18c2.4 2.4 2.4 7.2 0 9.6" strokeWidth={1.3} />
      <path d="M19.5 15c4 4 4 12 0 16" strokeWidth={1.3} />
      <line x1="22" y1="29" x2="28" y2="29" strokeDasharray="2.2 2.6" strokeWidth={1.4} />
      <rect x="28" y="21" width="12" height="16" rx="3" />
      <circle cx="34" cy="27" r="2.1" />
      <line x1="31" y1="33" x2="37" y2="33" strokeWidth={1.3} />
    </svg>
  );
}

export function TokenDispenserIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="10" y="14" width="22" height="14" rx="4" />
      <circle cx="16" cy="21" r="1.4" fill="currentColor" stroke="none" />
      <path d="M18 28l3 10 3-3 3 3 3-10" strokeLinejoin="round" />
    </svg>
  );
}

export function TokenDisplayIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <rect x="8" y="13" width="26" height="16" rx="3" />
      <g fill="currentColor" stroke="none">
        <circle cx="13.5" cy="18.5" r="1" />
        <circle cx="18" cy="18.5" r="1" />
        <circle cx="22.5" cy="18.5" r="1" />
        <circle cx="13.5" cy="23.5" r="1" />
        <circle cx="18" cy="23.5" r="1" />
        <circle cx="22.5" cy="23.5" r="1" />
        <circle cx="27" cy="18.5" r="1" />
        <circle cx="27" cy="23.5" r="1" />
      </g>
      <path d="M33 33l4-3v10l-4-3h-3v-4h3z" strokeLinejoin="round" />
      <path d="M40 30c1.8 2.4 1.8 7.6 0 10" strokeWidth={1.3} />
      <path d="M43 27c3 4 3 12.6 0 16.6" strokeWidth={1.2} />
    </svg>
  );
}

export function SosSirenIcon() {
  return (
    <svg {...iconProps} aria-hidden="true">
      <path d="M14 30a10 10 0 0 1 20 0z" />
      <line x1="12" y1="30" x2="36" y2="30" />
      <rect x="21" y="33" width="6" height="4" rx="1" />
      <path d="M24 15v-4" strokeWidth={1.4} />
      <path d="M17 17l6-6 6 6" strokeWidth={1.3} />
      <path d="M9 22c0-3.6 1.4-6.8 3.6-9.2" strokeWidth={1.2} />
      <path d="M35.4 12.8c2.2 2.4 3.6 5.6 3.6 9.2" strokeWidth={1.2} />
    </svg>
  );
}

export function FutureDeviceIcon() {
  return (
    <svg {...iconProps} aria-hidden="true" strokeDasharray="3 3.4">
      <rect x="10" y="10" width="28" height="28" rx="8" />
      <line x1="24" y1="17" x2="24" y2="31" strokeDasharray="none" />
      <line x1="17" y1="24" x2="31" y2="24" strokeDasharray="none" />
    </svg>
  );
}

const iconsByCategory: Record<DeviceCategory, Record<string, () => JSX.Element>> = {
  sense: { "tank-guard": TankGuardIcon, "nurse-call": NurseCallIcon },
  automate: { "rf-bridge": RfBridgeIcon },
  operate: { "token-dispenser": TokenDispenserIcon, "token-display": TokenDisplayIcon },
  protect: { "sos-siren": SosSirenIcon },
  future: { "future-device": FutureDeviceIcon }
};

export function DeviceIcon({ id, category }: { id: string; category: DeviceCategory }) {
  const Icon = iconsByCategory[category]?.[id];
  return Icon ? <Icon /> : null;
}
