import { FiActivity, FiAlertTriangle, FiCpu, FiDroplet } from "react-icons/fi";

export interface StatStripInput {
  online: number;
  total: number;
  waterLitres: number;
  alerts: number;
}

export function StatStrip({ online, total, waterLitres, alerts }: StatStripInput) {
  const cards = [
    {
      key: "online",
      label: "Devices online",
      value: `${online}/${total}`,
      color: "var(--green)",
      icon: <FiCpu />
    },
    {
      key: "water",
      label: "Water stored",
      value: `${(waterLitres / 1000).toFixed(1)}k L`,
      color: "var(--cyan2)",
      icon: <FiDroplet />
    },
    {
      key: "alerts",
      label: "Active alerts",
      value: String(alerts),
      color: "var(--red)",
      icon: <FiAlertTriangle />
    },
    {
      key: "data",
      label: "Data points / hr",
      value: "8.6k",
      color: "var(--violet)",
      icon: <FiActivity />
    }
  ];

  return (
    <div className="jx-stats">
      {cards.map((card) => (
        <div className="jx-stat" key={card.key}>
          <div className="k">
            <span className="ic" style={{ color: card.color }}>
              {card.icon}
            </span>
            {card.label}
          </div>
          <div className="v">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
