import {
  canCreateHomeShareCode,
  canManageHomeMembership,
  canRevokeHomeMember,
  type HomeMemberRecord
} from "@jenix/shared";
import { AppShell, StatusPill } from "@jenix/ui";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { useCurrentHome } from "../dashboard/hooks/useCurrentHome";
import {
  createHomeShareCode,
  listHomeMembers,
  listHomes,
  listHomeShareCodes,
  redeemHomeShareCode,
  revokeHomeMember,
  updateHomeMemberRole
} from "./services/homeApi";

export function HomeManagementPage() {
  const { session, replaceHomes, setActiveHome, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<HomeMemberRecord[]>([]);
  const [shareCodes, setShareCodes] = useState<
    Awaited<ReturnType<typeof listHomeShareCodes>>
  >([]);
  const [shareRole, setShareRole] = useState<"admin" | "member" | "viewer">("member");
  const [shareExpiresInHours, setShareExpiresInHours] = useState("24");
  const [redeemCode, setRedeemCode] = useState("");
  const [latestShareCode, setLatestShareCode] = useState<string | null>(null);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, "admin" | "member" | "viewer">>({});

  if (!session) {
    throw new Error("HomeManagementPage requires an authenticated session");
  }

  const currentSession = session;
  const currentHome = useCurrentHome(currentSession);
  const canManageMembers = canManageHomeMembership(currentHome.role);
  const canInviteMembers = canCreateHomeShareCode(currentHome.role);

  async function loadHomes() {
    setLoading(true);
    setError(null);

    try {
      replaceHomes(await listHomes(currentSession));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load HOME access."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentHomeDetails() {
    setMembersLoading(true);
    setError(null);

    try {
      const nextMembers = await listHomeMembers(currentSession, currentHome.homeId);
      setMembers(nextMembers);
      setMemberRoleDrafts(
        Object.fromEntries(
          nextMembers
            .filter((member) => member.role !== "owner")
            .map((member) => [member.userId, member.role])
        ) as Record<string, "admin" | "member" | "viewer">
      );

      if (canInviteMembers) {
        setShareCodes(await listHomeShareCodes(currentSession, currentHome.homeId));
      } else {
        setShareCodes([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load current HOME details."
      );
    } finally {
      setMembersLoading(false);
    }
  }

  useEffect(() => {
    void loadHomes();
  }, [currentSession.user.userId]);

  useEffect(() => {
    void loadCurrentHomeDetails();
  }, [currentSession.user.userId, currentHome.homeId, currentHome.role]);

  async function handleCreateShareCode() {
    setError(null);

    try {
      const record = await createHomeShareCode(currentSession, currentHome.homeId, {
        role: shareRole,
        expiresInHours: Number(shareExpiresInHours)
      });
      setLatestShareCode(record.code);
      if (canInviteMembers) {
        setShareCodes(await listHomeShareCodes(currentSession, currentHome.homeId));
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to create a HOME share code."
      );
    }
  }

  async function handleRedeemShareCode() {
    setError(null);

    try {
      const result = await redeemHomeShareCode(currentSession, redeemCode);
      replaceHomes(result.homes, result.home.homeId);
      setRedeemCode("");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to redeem the HOME share code."
      );
    }
  }

  async function handleRoleUpdate(member: HomeMemberRecord) {
    const nextRole = memberRoleDrafts[member.userId];

    if (!nextRole || nextRole === member.role || member.role === "owner") {
      return;
    }

    setError(null);

    try {
      setMembers(
        await updateHomeMemberRole(
          currentSession,
          currentHome.homeId,
          member.userId,
          nextRole
        )
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update HOME access."
      );
    }
  }

  async function handleRevoke(member: HomeMemberRecord) {
    setError(null);

    try {
      setMembers(
        await revokeHomeMember(currentSession, currentHome.homeId, member.userId)
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to revoke HOME access."
      );
    }
  }

  return (
    <AppShell
      eyebrow="Home Access"
      title="Manage Homes"
      description="Switch between accessible homes, invite shared users, redeem share codes, and tune role-based access for owner, admin, member, and viewer users."
      aside={<StatusPill label={currentHome.role.toUpperCase()} tone="neutral" />}
    >
      <section className="top-bar">
        <div>
          <span className="eyebrow">Active HOME</span>
          <h2>{currentHome.name}</h2>
        </div>
        <div className="top-bar-meta">
          <button className="text-button" type="button" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button className="text-button" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {error ? <section className="panel inline-error">{error}</section> : null}

      <section className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Accessible Homes</span>
            <h2>Choose the home you are operating right now</h2>
          </div>
          {loading ? <span>Refreshing homes...</span> : null}
        </div>
        <div className="home-card-grid">
          {currentSession.homes.map((home) => (
            <button
              key={home.homeId}
              className="home-card-button"
              data-active={home.homeId === currentHome.homeId}
              type="button"
              onClick={() => setActiveHome(home.homeId)}
            >
              <div className="home-card-head">
                <strong>{home.name}</strong>
                <StatusPill label={home.role.toUpperCase()} tone="neutral" />
              </div>
              <span className="hint-text">
                {home.ownerUserId === currentSession.user.userId
                  ? "Owned by you"
                  : `Owner: ${home.ownerUserId}`}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="content-grid">
        <section className="panel">
          <span className="eyebrow">Redeem Share Code</span>
          <h2>Join another HOME</h2>
          <div className="field">
            <label htmlFor="redeem-code">Share code</label>
            <input
              id="redeem-code"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value)}
              placeholder="JNX-AB12-CD34"
            />
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={() => void handleRedeemShareCode()}
            disabled={!redeemCode.trim()}
          >
            Join HOME
          </button>
        </section>

        <section className="panel">
          <span className="eyebrow">Invite Access</span>
          <h2>Create a share code</h2>
          {canInviteMembers ? (
            <>
              <div className="scene-form-grid">
                <label className="field">
                  <span>Role</span>
                  <select
                    value={shareRole}
                    onChange={(event) =>
                      setShareRole(event.target.value as "admin" | "member" | "viewer")
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <label className="field">
                  <span>Expires in hours</span>
                  <input
                    inputMode="numeric"
                    value={shareExpiresInHours}
                    onChange={(event) => setShareExpiresInHours(event.target.value)}
                  />
                </label>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => void handleCreateShareCode()}
              >
                Create Share Code
              </button>
              {latestShareCode ? (
                <p className="provisioning-note">
                  Latest code: <strong>{latestShareCode}</strong>
                </p>
              ) : null}
              <div className="home-share-list">
                {shareCodes.map((shareCode) => (
                  <article key={shareCode.shareCodeId} className="home-share-card">
                    <strong>{shareCode.code}</strong>
                    <span className="hint-text">
                      {shareCode.role.toUpperCase()} until{" "}
                      {new Date(shareCode.expiresAt).toLocaleString()}
                    </span>
                  </article>
                ))}
                {shareCodes.length === 0 ? (
                  <p className="hint-text">No active share codes for this HOME yet.</p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="hint-text">Only owner/admin users can create share codes.</p>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Members</span>
            <h2>Review and manage shared access</h2>
          </div>
          {membersLoading ? <span>Loading members...</span> : null}
        </div>
        <div className="home-member-list">
          {members.map((member) => {
            const canEditMember =
              canManageMembers &&
              member.role !== "owner" &&
              member.userId !== currentSession.user.userId;
            const canRemoveMember = canRevokeHomeMember(
              currentHome.role,
              member.role,
              member.userId === currentSession.user.userId
            );

            return (
              <article key={member.membershipId} className="home-member-card">
                <div className="home-member-copy">
                  <strong>{member.name}</strong>
                  <span className="hint-text">{member.email}</span>
                </div>
                <div className="home-member-actions">
                  <StatusPill label={member.role.toUpperCase()} tone="neutral" />
                  {canEditMember ? (
                    <>
                      <select
                        value={memberRoleDrafts[member.userId] ?? member.role}
                        onChange={(event) =>
                          setMemberRoleDrafts((current) => ({
                            ...current,
                            [member.userId]: event.target.value as "admin" | "member" | "viewer"
                          }))
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => void handleRoleUpdate(member)}
                      >
                        Update
                      </button>
                    </>
                  ) : null}
                  {canRemoveMember ? (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void handleRevoke(member)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {members.length === 0 ? (
            <p className="hint-text">No HOME members were found yet.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
