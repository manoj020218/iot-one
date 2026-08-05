import {
  FiGrid,
  FiBox,
  FiPlus,
  FiVideo,
  FiZap,
  FiSettings
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";

import { useHasSmartStreamerDevice } from "../../features/streamer/useHasSmartStreamerDevice";

type NavKey = "home" | "devices" | "streamer" | "scenes" | "settings";

interface NavItem {
  key: NavKey;
  label: string;
  icon: JSX.Element;
  path: string;
}

const leftItems: NavItem[] = [
  { key: "home", label: "Home", icon: <FiGrid size={20} />, path: "/home" },
  { key: "devices", label: "Devices", icon: <FiBox size={20} />, path: "/devices" }
];

const streamerItem: NavItem = {
  key: "streamer",
  label: "Streamer",
  icon: <FiVideo size={20} />,
  path: "/streamer"
};

const rightItems: NavItem[] = [
  { key: "scenes", label: "Scenes", icon: <FiZap size={20} />, path: "/scenes" },
  { key: "settings", label: "Settings", icon: <FiSettings size={20} />, path: "/settings" }
];

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "on" : ""} key={item.key} onClick={onClick} type="button">
      {item.icon}
      {item.label}
    </button>
  );
}

export function AppBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasSmartStreamer = useHasSmartStreamerDevice();

  // Only a home that actually owns a Smart Streamer device carries this
  // tab — everyone else's nav is unchanged by this product existing.
  const rightGroup = hasSmartStreamer ? [streamerItem, ...rightItems] : rightItems;

  return (
    <nav className="app-bottom-nav">
      {leftItems.map((item) => (
        <NavButton
          active={location.pathname.startsWith(item.path)}
          item={item}
          key={item.key}
          onClick={() => navigate(item.path)}
        />
      ))}
      <button
        aria-label="Add device"
        className="fab"
        onClick={() => navigate("/provisioning")}
        type="button"
      >
        <span className="ring">
          <FiPlus size={24} />
        </span>
      </button>
      {rightGroup.map((item) => (
        <NavButton
          active={location.pathname.startsWith(item.path)}
          item={item}
          key={item.key}
          onClick={() => navigate(item.path)}
        />
      ))}
    </nav>
  );
}
