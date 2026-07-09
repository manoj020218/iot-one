export interface SignalBarsProps {
  level: number; // 0..4
}

/** Four-step signal strength indicator. */
export function SignalBars({ level }: SignalBarsProps) {
  const heights = [7, 9, 11, 13];

  return (
    <span className="jx-bars">
      {heights.map((height, index) => (
        <i
          key={height}
          className={index < level ? "f" : ""}
          style={{ height }}
        />
      ))}
    </span>
  );
}
