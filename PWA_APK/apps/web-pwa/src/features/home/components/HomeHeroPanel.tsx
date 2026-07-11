import type { HomeDashboardResponse, HomeRecord } from "@jenix/shared";
import { FiChevronDown, FiMapPin, FiPlusCircle } from "react-icons/fi";

export interface HomeHeroPanelProps {
  currentHome: HomeRecord;
  dashboard: HomeDashboardResponse | null;
  loading: boolean;
  onCreateHome: () => void;
  onOpenSelector: () => void;
  userName: string;
}

export function HomeHeroPanel({
  currentHome,
  dashboard,
  loading,
  onCreateHome,
  onOpenSelector,
  userName
}: HomeHeroPanelProps) {
  return (
    <section className="home-hero panel">
      <div className="home-hero-head">
        <button className="home-switcher" onClick={onOpenSelector} type="button">
          <span className="eyebrow">Home</span>
          <strong>{currentHome.name}</strong>
          <FiChevronDown size={18} />
        </button>
        <button className="secondary-button" onClick={onCreateHome} type="button">
          <FiPlusCircle size={16} />
          Create Home
        </button>
      </div>

      <div className="home-hero-copy">
        <div>
          <h2>{userName.split(" ")[0] || "User"}, this HOME is ready for live control.</h2>
          <p>
            Devices, scenes, time reporting, and member access all follow the selected
            home context.
          </p>
        </div>
        <div className="home-hero-meta">
          <span className="status-chip" data-status={currentHome.allowed === false ? "failed" : "completed"}>
            {currentHome.allowed === false ? "Not Allowed" : "Live Access"}
          </span>
          {currentHome.locationLabel ? (
            <span className="hint-text home-meta-pill">
              <FiMapPin size={14} />
              {currentHome.locationLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="home-carousel" role="list">
        {(dashboard?.cards.length ? dashboard.cards : [{ cardId: "loading", title: currentHome.name, subtitle: "Preparing home summary", primaryValue: loading ? "Loading..." : "Ready", tone: "neutral" as const }]).map((card) => (
          <article className="home-slide" key={card.cardId} role="listitem">
            <div className="home-slide-top">
              <div>
                <span className="eyebrow">{card.title}</span>
                <h3>{card.primaryValue}</h3>
              </div>
              {card.badge ? (
                <span className="status-chip" data-status={card.tone === "warning" ? "failed" : "completed"}>
                  {card.badge}
                </span>
              ) : null}
            </div>
            <p>{card.subtitle}</p>
            {card.secondaryValue ? <strong>{card.secondaryValue}</strong> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
