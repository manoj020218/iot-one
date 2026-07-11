import type { HomeMemberRecord, HomeRecord, HomeShareCodeRecord } from "@jenix/shared";
import { getCurrentHome } from "@jenix/shared";
import { useEffect, useState } from "react";

import { useAuth } from "../../auth/hooks/useAuth";
import { HomeFormSheet } from "../../homes/components/HomeFormSheet";
import {
  createHome,
  createHomeShareCode,
  deleteHome,
  listHomeMembers,
  listHomeShareCodes,
  listHomes,
  redeemHomeShareCode,
  updateHome,
  updateHomeMemberAccess,
  type HomeUpsertInput
} from "../../homes/services/homeApi";
import { ManagedHomeCard } from "./ManagedHomeCard";

export function HomeManagementSection() {
  const { session, replaceHomes, setActiveHome } = useAuth();
  if (!session) throw new Error("HomeManagementSection requires a session");
  const activeSession = session;
  const currentHome = getCurrentHome(
    activeSession.homes,
    activeSession.user.userId,
    activeSession.activeHomeId
  );
  const [expandedHomeId, setExpandedHomeId] = useState(currentHome.homeId);
  const [editHome, setEditHome] = useState<HomeRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [membersByHome, setMembersByHome] = useState<Record<string, HomeMemberRecord[]>>({});
  const [codesByHome, setCodesByHome] = useState<Record<string, HomeShareCodeRecord[]>>({});

  useEffect(() => {
    if (activeSession.homes.length === 0) {
      void refreshHomes();
      return;
    }

    const targetHomeId = expandedHomeId || currentHome.homeId;
    if (!targetHomeId || !activeSession.homes.some((home) => home.homeId === targetHomeId)) {
      return;
    }

    void loadHomeDetails(targetHomeId);
  }, [activeSession.homes, currentHome.homeId, expandedHomeId]);

  async function loadHomeDetails(homeId: string) {
    try {
      const nextMembers = await listHomeMembers(activeSession, homeId);
      const nextCodes = await listHomeShareCodes(activeSession, homeId);
      setMembersByHome((current) => ({ ...current, [homeId]: nextMembers }));
      setCodesByHome((current) => ({ ...current, [homeId]: nextCodes }));
    } catch (loadError) {
      setMessage(loadError instanceof Error ? loadError.message : "Unable to load HOME details.");
    }
  }

  async function refreshHomes(activeHomeId = activeSession.activeHomeId) {
    replaceHomes(await listHomes(activeSession), activeHomeId);
  }

  async function handleSaveHome(input: HomeUpsertInput) {
    setSaving(true); setError(null);
    try {
      const record = editHome
        ? await updateHome(activeSession, editHome.homeId, input)
        : await createHome(activeSession, input);
      await refreshHomes(record.homeId); setFormOpen(false); setEditHome(null); setExpandedHomeId(record.homeId);
      setMessage(`${record.name} saved successfully.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save HOME.");
    } finally { setSaving(false); }
  }

  async function handleAddMember(home: HomeRecord) {
    try {
      const invite = await createHomeShareCode(activeSession, home.homeId, {
        role: "member",
        expiresInHours: 1
      });
      await loadHomeDetails(home.homeId);
      const shareText = `Join ${home.name} on Jenix One with code ${invite.code}. Valid for 1 hour.`;
      if (navigator.share) await navigator.share({ title: `Join ${home.name}`, text: shareText });
      else if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
      setMessage(`Invitation ${invite.code} is ready to share.`);
    } catch (shareError) {
      setMessage(shareError instanceof Error ? shareError.message : "Unable to create invitation.");
    }
  }

  async function handleDelete(home: HomeRecord) {
    if (!window.confirm(`Delete ${home.name}?`)) return;
    try {
      const homes = await deleteHome(activeSession, home.homeId);
      replaceHomes(homes, homes[0]?.homeId); setMessage(`${home.name} deleted.`);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "Unable to delete HOME.");
    }
  }

  async function handleJoinHome() {
    try {
      const result = await redeemHomeShareCode(activeSession, joinCode);
      replaceHomes(result.homes, result.home.homeId); setActiveHome(result.home.homeId);
      setMessage(`This ${result.home.name} by ${result.home.ownerUserId} you are allowed to access as ${result.home.name} Member.`);
      setJoinCode("");
    } catch (joinError) {
      setMessage(joinError instanceof Error ? joinError.message : "Unable to join HOME.");
    }
  }

  async function handleToggleAllowed(member: HomeMemberRecord, allowed: boolean) {
    try {
      const nextMembers = await updateHomeMemberAccess(
        activeSession,
        member.homeId,
        member.userId,
        allowed
      );
      setMembersByHome((current) => ({ ...current, [member.homeId]: nextMembers }));
    } catch (toggleError) {
      setMessage(toggleError instanceof Error ? toggleError.message : "Unable to update member access.");
    }
  }

  return (
    <>
      <section className="panel">
        <div className="home-card-head"><strong>Home Management</strong><button className="primary-button" onClick={() => { setEditHome(null); setFormOpen(true); }} type="button">Create Home</button></div>
        <p className="hint-text">Manage homes, members, invitation codes, and access permissions from one place.</p>
        <div className="home-card-grid">
          {activeSession.homes.map((home) => (
            <ManagedHomeCard expanded={expandedHomeId === home.homeId} home={home} key={home.homeId} members={membersByHome[home.homeId] ?? []} onAddMember={(record) => void handleAddMember(record)} onDelete={(record) => void handleDelete(record)} onEdit={(record) => { setEditHome(record); setFormOpen(true); }} onToggleAllowed={(member, allowed) => void handleToggleAllowed(member, allowed)} onToggleExpand={(homeId) => setExpandedHomeId(expandedHomeId === homeId ? "" : homeId)} shareCodes={codesByHome[home.homeId] ?? []} />
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="home-card-head"><strong>Join a Home</strong><span>{currentHome.name}</span></div>
        <label className="field"><span>Enter Invitation Code</span><input onChange={(event) => setJoinCode(event.target.value)} placeholder="JNX-XXXX-XXXX" value={joinCode} /></label>
        <div className="button-row"><button className="primary-button" disabled={!joinCode.trim()} onClick={() => void handleJoinHome()} type="button">Join Home</button></div>
        {message ? <p className="hint-text">{message}</p> : null}
      </section>
      <HomeFormSheet open={formOpen} title={editHome ? "Edit Home" : "Create Home"} subtitle="Save name, timezone, and optional location for this home." {...(editHome ? { initialValue: { name: editHome.name, ...(editHome.timezone ? { timezone: editHome.timezone } : {}), ...(editHome.locationLabel ? { locationLabel: editHome.locationLabel } : {}), ...(editHome.latitude !== undefined ? { latitude: editHome.latitude } : {}), ...(editHome.longitude !== undefined ? { longitude: editHome.longitude } : {}) } } : {})} submitting={saving} error={error} onClose={() => { setFormOpen(false); setEditHome(null); }} onSubmit={handleSaveHome} />
    </>
  );
}
