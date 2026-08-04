import { useEffect, useState } from "react";

import { canAssignHomeRole, type HomeAccessRole, type HomeMemberRecord } from "@jenix/shared";

import { Sheet } from "../../../app/components/Sheet";

export interface ManageMemberSheetProps {
  open: boolean;
  member: HomeMemberRecord | null;
  actorRole: HomeAccessRole;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onChangeRole: (member: HomeMemberRecord, role: Exclude<HomeAccessRole, "owner">) => void;
  onToggleAccess: (member: HomeMemberRecord, allowed: boolean) => void;
  onRemove: (member: HomeMemberRecord) => void;
}

const roleDescriptions: Record<Exclude<HomeAccessRole, "owner">, string> = {
  admin: "Can manage devices, scenes, and members",
  member: "Can control devices and run scenes",
  viewer: "Can view devices only, no control"
};

const assignableRoles: Array<Exclude<HomeAccessRole, "owner">> = ["admin", "member", "viewer"];

export function ManageMemberSheet({
  open,
  member,
  actorRole,
  saving,
  error,
  onClose,
  onChangeRole,
  onToggleAccess,
  onRemove
}: ManageMemberSheetProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setConfirmRemove(false);
  }, [open, member?.membershipId]);

  if (!member) {
    return null;
  }

  function handleRemoveClick() {
    if (!member) {
      return;
    }

    if (!confirmRemove) {
      setConfirmRemove(true);
      setTimeout(() => setConfirmRemove(false), 5000);
      return;
    }

    onRemove(member);
  }

  return (
    <Sheet
      onClose={onClose}
      open={open}
      subtitle="Change what this member can do in this home."
      title={`Manage ${member.name}`}
    >
      <div>
        {assignableRoles
          .filter((role) => canAssignHomeRole(actorRole, role))
          .map((role) => (
          <button
            className="role-option"
            data-selected={member.role === role}
            key={role}
            onClick={() => onChangeRole(member, role)}
            type="button"
          >
            <span>
              <strong>{role.charAt(0).toUpperCase() + role.slice(1)}</strong>
              <span>{roleDescriptions[role]}</span>
            </span>
            <span className="role-check" />
          </button>
        ))}
      </div>
      <div className="access-row">
        <div>
          <strong>Allowed in this home</strong>
          <span>Turn off to block access without removing them</span>
        </div>
        <button
          aria-label="Toggle access"
          className="switch"
          data-on={member.allowed !== false}
          onClick={() => onToggleAccess(member, member.allowed === false)}
          type="button"
        />
      </div>
      {error ? <p className="inline-error">{error}</p> : null}
      <button
        className="danger-button"
        disabled={saving}
        onClick={handleRemoveClick}
        style={{ width: "100%" }}
        type="button"
      >
        {saving ? "Removing..." : confirmRemove ? "Tap again to remove" : "Remove from home"}
      </button>
    </Sheet>
  );
}
