import type { HomeAccessRole, HomeMemberRecord, HomeShareCodeRecord } from "@jenix/shared";
import { canRevokeHomeMember } from "@jenix/shared";
import { AppShell } from "@jenix/ui";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiPlus } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import {
  createHomeShareCode,
  listHomeMembers,
  listHomeShareCodes,
  revokeHomeMember,
  updateHomeMemberAccess,
  updateHomeMemberRole
} from "../homes/services/homeApi";
import { AddMemberSheet } from "./components/AddMemberSheet";
import { HomeMemberRow } from "./components/HomeMemberRow";
import { ManageMemberSheet } from "./components/ManageMemberSheet";

export function HomeMembersPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { homeId } = useParams<{ homeId: string }>();

  if (!session) {
    throw new Error("HomeMembersPage requires an authenticated session");
  }

  const activeSession = session;
  const home = activeSession.homes.find((item) => item.homeId === homeId);
  const canManage = home?.role === "owner" || home?.role === "admin";

  const [members, setMembers] = useState<HomeMemberRecord[]>([]);
  const [shareCodes, setShareCodes] = useState<HomeShareCodeRecord[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [featuredCodeId, setFeaturedCodeId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [manageMember, setManageMember] = useState<HomeMemberRecord | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!home) {
      return;
    }

    void listHomeMembers(activeSession, home.homeId)
      .then(setMembers)
      .catch(() => setMembers([]));

    if (canManage) {
      void listHomeShareCodes(activeSession, home.homeId)
        .then(setShareCodes)
        .catch(() => setShareCodes([]));
    }
  }, [activeSession, home?.homeId, canManage]);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast((current) => (current === text ? null : current)), 2400);
  }

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

  async function generateInvite() {
    setGenerating(true);

    try {
      const invite = await createHomeShareCode(activeSession, home!.homeId, {
        role: "member",
        expiresInHours: 1
      });
      setShareCodes((current) => [invite, ...current]);
      setFeaturedCodeId(invite.shareCodeId);
    } catch (generateError) {
      showToast(
        generateError instanceof Error
          ? generateError.message
          : "Unable to create an invitation code."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleOpenAddMember() {
    setAddMemberOpen(true);
    await generateInvite();
  }

  async function shareInviteText(code: HomeShareCodeRecord) {
    return `Join ${home!.name} on Jenix One with code ${code.code}. Valid for 1 hour.`;
  }

  async function handleCopy(code: HomeShareCodeRecord) {
    const text = await shareInviteText(code);
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showToast("Invitation code copied.");
    }
  }

  async function handleShare(code: HomeShareCodeRecord) {
    const text = await shareInviteText(code);
    if (navigator.share) {
      await navigator.share({ title: `Join ${home!.name}`, text });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showToast("Sharing isn't available here — code copied instead.");
    }
  }

  function openManageMember(member: HomeMemberRecord) {
    setManageMember(member);
    setManageError(null);
    setManageOpen(true);
  }

  async function handleChangeRole(
    member: HomeMemberRecord,
    role: Exclude<HomeAccessRole, "owner">
  ) {
    setManageSaving(true);
    setManageError(null);

    try {
      const nextMembers = await updateHomeMemberRole(
        activeSession,
        home!.homeId,
        member.userId,
        role
      );
      setMembers(nextMembers);
      setManageMember(
        nextMembers.find((item) => item.userId === member.userId) ?? null
      );
      showToast(`${member.name} is now ${role}.`);
    } catch (changeError) {
      setManageError(
        changeError instanceof Error ? changeError.message : "Unable to update role."
      );
    } finally {
      setManageSaving(false);
    }
  }

  async function handleToggleAccess(member: HomeMemberRecord, allowed: boolean) {
    setManageSaving(true);
    setManageError(null);

    try {
      const nextMembers = await updateHomeMemberAccess(
        activeSession,
        home!.homeId,
        member.userId,
        allowed
      );
      setMembers(nextMembers);
      setManageMember(
        nextMembers.find((item) => item.userId === member.userId) ?? null
      );
    } catch (toggleError) {
      setManageError(
        toggleError instanceof Error ? toggleError.message : "Unable to update access."
      );
    } finally {
      setManageSaving(false);
    }
  }

  async function handleRemove(member: HomeMemberRecord) {
    setManageSaving(true);
    setManageError(null);

    try {
      const nextMembers = await revokeHomeMember(activeSession, home!.homeId, member.userId);
      setMembers(nextMembers);
      setManageOpen(false);
      showToast(`${member.name} removed from ${home!.name}.`);
    } catch (removeError) {
      setManageError(
        removeError instanceof Error ? removeError.message : "Unable to remove this member."
      );
    } finally {
      setManageSaving(false);
    }
  }

  const featuredCode = shareCodes.find((code) => code.shareCodeId === featuredCodeId) ?? null;
  const otherCodes = shareCodes.filter((code) => code.shareCodeId !== featuredCodeId);

  return (
    <AppShell
      eyebrow="Home Members"
      title={home.name}
      aside={
        canManage ? (
          <button
            aria-label="Invite member"
            className="devices-add-button"
            onClick={() => void handleOpenAddMember()}
            type="button"
          >
            <FiPlus size={20} />
          </button>
        ) : undefined
      }
    >
      <button className="editor-back" onClick={() => navigate(`/settings/homes/${home.homeId}`)} type="button">
        <FiArrowLeft size={16} />
        {home.name}
      </button>

      <div style={{ display: "grid", gap: 10 }}>
        {members.map((member) => (
          <HomeMemberRow
            isSelf={member.userId === activeSession.user.userId}
            key={member.membershipId}
            manageable={
              canManage &&
              canRevokeHomeMember(
                home.role,
                member.role,
                member.userId === activeSession.user.userId
              )
            }
            member={member}
            onOpen={openManageMember}
          />
        ))}
      </div>

      <p className="hint-text" style={{ marginTop: 12 }}>
        Tap a member to change their role or remove them. Owners can&apos;t be changed or
        removed.
      </p>

      <AddMemberSheet
        featuredCode={featuredCode}
        generating={generating}
        members={members}
        onClose={() => setAddMemberOpen(false)}
        onCopy={(code) => void handleCopy(code)}
        onGenerateAnother={() => void generateInvite()}
        onShare={(code) => void handleShare(code)}
        open={addMemberOpen}
        otherCodes={otherCodes}
      />

      <ManageMemberSheet
        actorRole={home.role}
        error={manageError}
        member={manageMember}
        onChangeRole={(member, role) => void handleChangeRole(member, role)}
        onClose={() => setManageOpen(false)}
        onRemove={(member) => void handleRemove(member)}
        onToggleAccess={(member, allowed) => void handleToggleAccess(member, allowed)}
        open={manageOpen}
        saving={manageSaving}
      />

      {toast ? <div className="jx-toast">{toast}</div> : null}
    </AppShell>
  );
}
