interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" fill="#16233f" />
      <path
        d="M17 25a21 21 0 0 1 30 0"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M22 31a14 14 0 0 1 20 0"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="38" r="5" fill="#fff" />
    </svg>
  );
}

export function Logo({ size = 40, withWordmark = true }: LogoProps) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      {withWordmark ? (
        <span className="logo-wordmark">
          <strong>Smart One</strong>
          <small>OEM IoT Platform · by Jenix</small>
        </span>
      ) : null}
    </span>
  );
}
