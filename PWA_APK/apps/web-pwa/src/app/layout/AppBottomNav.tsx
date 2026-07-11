import {
  FiGrid,
  FiBox,
  FiPlus,
  FiZap,
  FiSettings
} from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";

type NavKey = "home" | "devices" | "scenes" | "settings";

const navItems: Array<{ key: NavKey; label: string; icon: JSX.Element; path: string }> = [
  { key: "home", label: "Home", icon: <FiGrid size={20} />, path: "/home" },
  { key: "devices", label: "Devices", icon: <FiBox size={20} />, path: "/devices" },
  { key: "scenes", label: "Scenes", icon: <FiZap size={20} />, path: "/scenes" },
  { key: "settings", label: "Settings", icon: <FiSettings size={20} />, path: "/settings" }
];

export function AppBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="app-bottom-nav">
      {navItems.slice(0, 2).map((item) => (
        <button
          className={location.pathname.startsWith(item.path) ? "on" : ""}
          key={item.key}
          onClick={() => navigate(item.path)}
          type="button"
        >
          {item.icon}
          {item.label}
        </button>
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
      {navItems.slice(2).map((item) => (
        <button
          className={location.pathname.startsWith(item.path) ? "on" : ""}
          key={item.key}
          onClick={() => navigate(item.path)}
          type="button"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
}
