import type { HomeMemberRecord } from "@jenix/shared";
import { AppShell } from "@jenix/ui";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiChevronRight, FiHome } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { HomeFormSheet } from "../homes/components/HomeFormSheet";
import {
  deleteHome,
  leaveHome,
  listHomeMembers,
  listHomes,
  updateHome,
  type HomeUpsertInput
} from "../homes/services/homeApi";
import { avatarColorFor, initials } from "./utils/avatar";

export function HomeDetailPage() {
  const { session, replaceHomes } = useAuth();
  const navigate = useNavigate();
  const { homeId } = useParams<{ homeId: string }>();

  if (!session) {
    throw new Error("HomeDetailPage requires an authenticated session");
  }

  const activeSession = session;
  const home = activeSession.homes.find((item) => item.homeId === homeId);
  const [members, setMembers] = useState<HomeMemberRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDanger, setConfirmDanger] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  useEffect(() => {
    if (!home) {
      return;
    }

    void listHomeMembers(activeSession, home.homeId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [activeSession, home?.homeId]);

  if (!home) {
    return (
      <AppShell eyebrow="Settings" title="Home not found">
        <button className="editor-back" onClick={() => navigate("/settings/homes")} type="button">
          <FiArrowLeft size={16} />
          Home Management
        </button>
        <p className="hint-text">This home is no longer available.</p>
      </AppShell>
    );
  }

  const canEdit = home.role === "owner" || home.role === "admin";
  const isOwner = home.role === "owner";

  async function refreshHomes(activeHomeId?: string) {
    replaceHomes(await listHomes(activeSession), activeHomeId);
  }

  async function handleSave(input: HomeUpsertInput) {
    setSaving(true);
    setError(null);

    try {
      await updateHome(activeSession, home!.homeId, input);
      await refreshHomes(home!.homeId);
      setFormOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save home.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDangerAction() {
    if (!confirmDanger) {
      setConfirmDanger(true);
      setTimeout(() => setConfirmDanger(false), 5000);
      return;
    }

    setDangerBusy(true);
    setDangerError(null);

    try {
      const homes = isOwner
        ? await deleteHome(activeSession, home!.homeId)
        : await leaveHome(activeSession, home!.homeId);
      replaceHomes(homes, homes[0]?.homeId);
      navigate("/settings/homes");
    } catch (dangerActionError) {
      setDangerError(
        dangerActionError instanceof Error
          ? dangerActionError.message
          : `Unable to ${isOwner ? "delete" : "leave"} this home.`
      );
      setConfirmDanger(false);
    } finally {
      setDangerBusy(false);
    }
  }

  return (
    <AppShell
      eyebrow="Home Management"
      title={home.name}
      aside={
        <span className="role-pill" data-role={home.role}>
          {home.role}
        </span>
      }
    >
      <button className="editor-back" onClick={() => navigate("/settings/homes")} type="button">
        <FiArrowLeft size={16} />
        Home Management
      </button>

      <div className="settings-list" style={{ marginBottom: 16 }}>
        <button
          className="settings-row"
          disabled={!canEdit}
          onClick={() => canEdit && setFormOpen(true)}
          type="button"
        >
          <span className="settings-row-label">
            <strong>Home Name</strong>
          </span>
          <span className="settings-row-value">{home.name}</span>
          {canEdit ? <FiChevronRight className="settings-row-chev" size={16} /> : null}
        </button>
        <button
          className="settings-row"
          disabled={!canEdit}
          onClick={() => canEdit && setFormOpen(true)}
          type="button"
        >
          <span className="settings-row-label">
            <strong>Location</strong>
          </span>
          <span className="settings-row-value">{home.locationLabel ?? "Not set"}</span>
          {canEdit ? <FiChevronRight className="settings-row-chev" size={16} /> : null}
        </button>
        <button
          className="settings-row"
          disabled={!canEdit}
          onClick={() => canEdit && setFormOpen(true)}
          type="button"
        >
          <span className="settings-row-label">
            <strong>Time Zone</strong>
          </span>
          <span className="settings-row-value">{home.timezone ?? "Asia/Kolkata"}</span>
          {canEdit ? <FiChevronRight className="settings-row-chev" size={16} /> : null}
        </button>
      </div>

      <div className="settings-list" style={{ marginBottom: 16 }}>
        <button
          className="settings-row"
          onClick={() => navigate(`/settings/homes/${home.homeId}/members`)}
          type="button"
        >
          <span className="settings-row-icon">
            <FiHome size={17} />
          </span>
          <span className="settings-row-label">
            <strong>Home Members</strong>
            <span>{members.length === 1 ? "1 member" : `${members.length} members`}</span>
          </span>
          <span className="avatar-stack">
            {members.slice(0, 3).map((member) => (
              <span
                className="avatar"
                key={member.membershipId}
                style={{ background: avatarColorFor(member.userId) }}
              >
                {initials(member.name)}
              </span>
            ))}
          </span>
          <FiChevronRight className="settings-row-chev" size={16} />
        </button>
      </div>

      {dangerError ? <p className="inline-error">{dangerError}</p> : null}
      {isOwner && home.isDefault ? null : (
        <button className="danger-link" disabled={dangerBusy} onClick={() => void handleDangerAction()} type="button">
          {dangerBusy
            ? isOwner
              ? "Deleting..."
              : "Leaving..."
            : confirmDanger
              ? "Tap again to confirm"
              : isOwner
                ? "Delete Home"
                : "Leave Home"}
        </button>
      )}

      <HomeFormSheet
        error={error}
        initialValue={{
          name: home.name,
          ...(home.timezone ? { timezone: home.timezone } : {}),
          ...(home.locationLabel ? { locationLabel: home.locationLabel } : {}),
          ...(home.latitude !== undefined ? { latitude: home.latitude } : {}),
          ...(home.longitude !== undefined ? { longitude: home.longitude } : {})
        }}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
        open={formOpen}
        submitting={saving}
        subtitle="Update the name, timezone, and location for this home."
        title="Edit Home"
      />
    </AppShell>
  );
}
