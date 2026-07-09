import { FiBell } from "react-icons/fi";

export interface HomeHeaderProps {
  userName: string;
  onlineCount: number;
  totalCount: number;
  alertCount: number;
  onBell: () => void;
}

export function HomeHeader({ userName, onlineCount, totalCount, alertCount, onBell }: HomeHeaderProps) {
  const greeting = new Date().getHours() < 18 ? "Good day" : "Good evening";

  return (
    <header className="jx-head">
      <div className="hi">
        <h1>
          {greeting}, {userName.split(" ")[0] || "there"} 👋
        </h1>
        <p>
          <b style={{ color: onlineCount === totalCount ? "var(--green)" : "var(--amber)" }}>
            {onlineCount} of {totalCount} devices online
          </b>
        </p>
      </div>
      <div className="sp" />
      <button className="jx-iconbtn" onClick={onBell} aria-label="Alerts">
        <FiBell size={20} />
        {alertCount > 0 ? <span className="badge">{alertCount}</span> : null}
      </button>
    </header>
  );
}
