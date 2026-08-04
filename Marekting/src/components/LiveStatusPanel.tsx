import { useEffect, useState } from "react";

interface MetricRow {
  label: string;
  value: string;
}

const CONNECTIVITY_CHIPS = ["PWA + Android", "MQTT / REST", "OEM Branding", "Gateways & Sensors"];
const SPARK_BARS = Array.from({ length: 14 }, (_, index) => index);

function useTicker(intervalMs: number) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((current) => current + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return tick;
}

export function LiveStatusPanel() {
  const tick = useTicker(2600);

  const tankLevel = 64 + Math.round(Math.sin(tick * 0.7) * 6);
  const devicesOnline = 24 + (tick % 3 === 0 ? 1 : 0);
  const alerts = tick % 5 === 0 ? 1 : 0;
  const syncSeconds = (tick % 4) * 3 + 1;

  const metrics: MetricRow[] = [
    { label: "Tank Guard level", value: `${tankLevel}%` },
    { label: "Devices online", value: `${devicesOnline} / 26` },
    { label: "Active alerts", value: String(alerts) },
    { label: "Last sync", value: syncSeconds <= 1 ? "just now" : `${syncSeconds}s ago` }
  ];

  return (
    <div className="live-panel">
      <div className="live-panel-head">
        <span className="live-badge">
          <span className="live-dot" aria-hidden="true" />
          Live
        </span>
        <span className="live-panel-tag">Sample fleet data</span>
      </div>

      <p className="live-panel-title">Smart One fleet overview</p>

      <div className="live-metric-grid">
        {metrics.map((metric) => (
          <div className="live-metric" key={metric.label}>
            <span className="live-metric-value">{metric.value}</span>
            <span className="live-metric-label">{metric.label}</span>
          </div>
        ))}
      </div>

      <div className="live-spark" aria-hidden="true">
        {SPARK_BARS.map((bar) => (
          <span className="live-spark-bar" key={bar} style={{ animationDelay: `${bar * 0.12}s` }} />
        ))}
      </div>

      <div className="live-chip-row">
        {CONNECTIVITY_CHIPS.map((chip) => (
          <span className="live-chip" key={chip}>
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
