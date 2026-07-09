import { useId } from "react";

import { levelColor } from "../telemetry/deviceTelemetry";

export interface TankGaugeProps {
  pct: number;
  size?: number;
  showLabel?: boolean;
}

/** Animated liquid-fill tank gauge (pure SVG — no canvas, Capacitor-safe). */
export function TankGauge({ pct, size = 92, showLabel = true }: TankGaugeProps) {
  const id = useId().replace(/[:]/g, "");
  const color = levelColor(pct);
  const baseline = 100 - Math.max(3, Math.min(98, pct));

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <clipPath id={`clip-${id}`}>
            <circle cx="50" cy="50" r="42" />
          </clipPath>
          <linearGradient id={`lg-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.95" />
            <stop offset="1" stopColor={color} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <g clipPath={`url(#clip-${id})`}>
          <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.03)" />
          <path fill={`url(#lg-${id})`}>
            <animate
              attributeName="d"
              dur="3.2s"
              repeatCount="indefinite"
              values={`M0,${baseline} q25,-6 50,0 t50,0 V100 H0 Z;M0,${baseline} q25,6 50,0 t50,0 V100 H0 Z;M0,${baseline} q25,-6 50,0 t50,0 V100 H0 Z`}
            />
          </path>
          <path fill={color} opacity="0.35">
            <animate
              attributeName="d"
              dur="2.4s"
              repeatCount="indefinite"
              values={`M0,${baseline + 2} q25,6 50,0 t50,0 V100 H0 Z;M0,${baseline + 2} q25,-6 50,0 t50,0 V100 H0 Z;M0,${baseline + 2} q25,6 50,0 t50,0 V100 H0 Z`}
            />
          </path>
        </g>
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.5"
          strokeDasharray={`${pct * 2.89} 289`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      {showLabel ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeContent: "center",
            textAlign: "center"
          }}
        >
          <b style={{ fontSize: size * 0.23, fontWeight: 800, color, letterSpacing: "-1px" }}>
            {Math.round(pct)}
            <span style={{ fontSize: size * 0.12 }}>%</span>
          </b>
        </div>
      ) : null}
    </div>
  );
}
