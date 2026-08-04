import { AppShell } from "@jenix/ui";
import { ensureDefaultHome, getCurrentHome as getSelectedHome } from "@jenix/shared";
import { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { Sheet } from "../../app/components/Sheet";
import { useAuth } from "../auth/hooks/useAuth";
import { HomeListRow } from "./components/HomeListRow";
import { avatarColorFor, initials } from "./utils/avatar";

export function UserProfilePage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  if (!session) {
    throw new Error("UserProfilePage requires an authenticated session");
  }

  const homes = ensureDefaultHome(session.homes, session.user.userId);
  const currentHome = getSelectedHome(
    homes,
    session.user.userId,
    session.activeHomeId
  );

  return (
    <AppShell
      eyebrow="Settings"
      title="Profile"
      aside={<span className="role-pill" data-role={currentHome.role}>{currentHome.role}</span>}
    >
      <button className="editor-back" onClick={() => navigate("/settings")} type="button">
        <FiArrowLeft size={16} />
        Settings
      </button>

      <div className="panel" style={{ display: "grid", gap: 14, justifyItems: "center", marginBottom: 16, textAlign: "center" }}>
        <span className="avatar avatar-lg" style={{ background: avatarColorFor(session.user.userId) }}>
          {initials(session.user.name)}
        </span>
        <div>
          <h2 style={{ margin: 0 }}>{session.user.name}</h2>
          <p className="hint-text" style={{ margin: "4px 0 0" }}>{session.user.email}</p>
        </div>
        <span className="status-chip">{session.user.provider}</span>
      </div>

      <span className="eyebrow">Your homes</span>
      <div style={{ display: "grid", gap: 10, marginTop: 8, marginBottom: 20 }}>
        {homes.map((home) => (
          <HomeListRow home={home} key={home.homeId} onClick={() => navigate(`/settings/homes/${home.homeId}`)} />
        ))}
      </div>

      <button className="danger-link" onClick={() => setLogoutOpen(true)} type="button">
        Log Out
      </button>

      <Sheet
        actions={
          <>
            <button className="secondary-button" onClick={() => setLogoutOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="danger-button"
              onClick={() => {
                setLogoutOpen(false);
                logout();
              }}
              type="button"
            >
              Log Out
            </button>
          </>
        }
        onClose={() => setLogoutOpen(false)}
        open={logoutOpen}
        subtitle="You'll need to sign in again to access your homes."
        title="Log out of Jenix One?"
      >
        <p className="hint-text" style={{ margin: 0 }}>
          Signed in as {session.user.email}
        </p>
      </Sheet>
    </AppShell>
  );
}
