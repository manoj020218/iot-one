import type { ReactNode } from "react";
import { FiCalendar, FiChevronRight, FiList, FiLogOut, FiMic, FiMusic, FiSettings, FiUsers } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

export interface MoreScreenProps {
  homeId: string;
  onOpenHolidays: () => void;
  onOpenLogs: () => void;
  onOpenSettings: () => void;
  onOpenFestival: () => void;
  onOpenAnnounce: () => void;
}

/**
 * "Members & sharing" deliberately leaves the plugin entirely and opens
 * the platform's own Home Members page (/settings/homes/:homeId/members)
 * instead of reimplementing HOME membership here — that's platform-level
 * state, not School-Bell-specific, and the platform already owns it (see
 * DEVICE_INTEGRATION_GUIDE.md's "HOME Sharing Compatibility": the device
 * needs no custom behavior for this).
 */
export function MoreScreen({ homeId, onOpenHolidays, onOpenLogs, onOpenSettings, onOpenFestival, onOpenAnnounce }: MoreScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="sb-page">
      <div className="sb-head">
        <div className="hi">
          <h1>More</h1>
        </div>
      </div>
      <div className="sb-card">
        <Row icon={<FiMic size={16} />} onClick={onOpenAnnounce} subtitle="Live mic, press and hold" title="Announce" />
        <Row icon={<FiMusic size={16} />} onClick={onOpenFestival} subtitle="One-off track for a school event" title="Festival track" />
        <Row icon={<FiCalendar size={16} />} onClick={onOpenHolidays} subtitle="Suppresses auto bells" title="Holidays" />
        <Row icon={<FiList size={16} />} onClick={onOpenLogs} subtitle="Every ring, manual & automatic" title="Activity log" />
        <Row
          icon={<FiUsers size={16} />}
          onClick={() => navigate(`/settings/homes/${homeId}/members`)}
          subtitle="Manage who can access this bell"
          title="Members & sharing"
        />
        <Row icon={<FiSettings size={16} />} onClick={onOpenSettings} subtitle="Wi-Fi, volume, connection mode" title="Device settings" />
      </div>
      <button className="sb-btn ghost" onClick={() => navigate("/settings")} style={{ color: "var(--danger)" }} type="button">
        <FiLogOut size={15} /> Platform settings
      </button>
    </div>
  );
}

function Row({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button className="sb-row clickable" onClick={onClick} style={{ width: "100%", border: "none", background: "none", textAlign: "left" }} type="button">
      <div className="swatch">{icon}</div>
      <div className="body">
        <div className="t">{title}</div>
        <div className="s">{subtitle}</div>
      </div>
      <div className="r">
        <FiChevronRight color="var(--faint)" size={14} />
      </div>
    </button>
  );
}
