import { FiAlertTriangle, FiCpu } from "react-icons/fi";

export interface StatStripInput {
  online: number;
  total: number;
  alerts: number;
}

export function StatStrip({ online, total, alerts }: StatStripInput) {
  const cards = [
    {
      key: "online",
      label: "Devices online",
      value: `${online}/${total}`,
      color: "var(--green)",
      icon: <FiCpu />
    },
    {
      key: "alerts",
      label: "Active alerts",
      value: String(alerts),
      color: "var(--red)",
      icon: <FiAlertTriangle />
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
