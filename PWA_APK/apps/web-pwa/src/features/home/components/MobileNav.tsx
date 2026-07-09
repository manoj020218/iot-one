import { FiGrid, FiZap, FiPlus, FiBarChart2, FiSettings } from "react-icons/fi";

export type NavTab = "home" | "scenes" | "insights" | "settings";

export interface MobileNavProps {
  active: NavTab;
  onSelect: (tab: NavTab) => void;
  onAddDevice: () => void;
}

/** Bottom tab bar with a centered add-device FAB (Tuya-style, thumb-reach). */
export function MobileNav({ active, onSelect, onAddDevice }: MobileNavProps) {
  return (
    <nav className="jx-nav">
      <button className={active === "home" ? "on" : ""} onClick={() => onSelect("home")}>
        <FiGrid size={20} />
        Home
      </button>
      <button className={active === "scenes" ? "on" : ""} onClick={() => onSelect("scenes")}>
        <FiZap size={20} />
        Scenes
      </button>
      <button className="fab" onClick={onAddDevice} aria-label="Add device">
        <span className="ring">
          <FiPlus size={26} strokeWidth={2.5} />
        </span>
      </button>
      <button className={active === "insights" ? "on" : ""} onClick={() => onSelect("insights")}>
        <FiBarChart2 size={20} />
        Insights
      </button>
      <button className={active === "settings" ? "on" : ""} onClick={() => onSelect("settings")}>
        <FiSettings size={20} />
        Settings
      </button>
    </nav>
  );
}
