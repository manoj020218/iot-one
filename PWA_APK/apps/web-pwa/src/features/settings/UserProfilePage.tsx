import { AppShell, StatusPill } from "@jenix/ui";
import { ensureDefaultHome, getCurrentHome as getSelectedHome } from "@jenix/shared";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";

export function UserProfilePage() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

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
      eyebrow="Profile"
      title="User Profile"
      description="Your account identity and the homes you have access to."
      aside={<StatusPill label={currentHome.role.toUpperCase()} tone="neutral" />}
    >
      <section className="tabs-strip">
        <button
          className="text-button"
          type="button"
          onClick={() => navigate("/settings")}
        >
          Manage Homes
        </button>
        <button className="text-button" type="button" onClick={logout}>
          Logout
        </button>
      </section>
      <section className="panel">
        <dl className="summary-grid">
          <div>
            <dt>Name</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.user.email}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{session.user.provider}</dd>
          </div>
          <div>
            <dt>Current Home</dt>
            <dd>{currentHome.name}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{currentHome.role}</dd>
          </div>
          <div>
            <dt>Accessible Homes</dt>
            <dd>{homes.length}</dd>
          </div>
        </dl>
      </section>
      <section className="home-member-list">
        {homes.map((home) => (
          <article key={home.homeId} className="home-member-card">
            <div className="home-member-actions">
              <strong>{home.name}</strong>
              <span>{home.role}</span>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
