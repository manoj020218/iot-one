import type { HomeMemberRecord, HomeRecord, HomeShareCodeRecord } from "@jenix/shared";
import { FiChevronDown, FiChevronRight, FiHome } from "react-icons/fi";

export interface ManagedHomeCardProps {
  expanded: boolean;
  home: HomeRecord;
  members: HomeMemberRecord[];
  onAddMember: (home: HomeRecord) => void;
  onDelete: (home: HomeRecord) => void;
  onEdit: (home: HomeRecord) => void;
  onToggleAllowed: (member: HomeMemberRecord, allowed: boolean) => void;
  onToggleExpand: (homeId: string) => void;
  shareCodes: HomeShareCodeRecord[];
}

function describeShareCodeStatus(
  shareCode: HomeShareCodeRecord,
  members: HomeMemberRecord[]
): string {
  if (shareCode.redeemedByUserId) {
    const redeemedBy = members.find(
      (member) => member.userId === shareCode.redeemedByUserId
    );
    return `Accepted by ${redeemedBy?.name ?? redeemedBy?.email ?? "a new member"}`;
  }

  const timeLeftMs = new Date(shareCode.expiresAt).getTime() - Date.now();
  if (timeLeftMs <= 0) {
    return "Code expired due to time";
  }

  const minutes = Math.max(1, Math.ceil(timeLeftMs / 60_000));
  return `Waiting for acceptance - ${minutes} min left`;
}

export function ManagedHomeCard({
  expanded,
  home,
  members,
  onAddMember,
  onDelete,
  onEdit,
  onToggleAllowed,
  onToggleExpand,
  shareCodes
}: ManagedHomeCardProps) {
  return (
    <article className="panel home-list-item">
      <button
        aria-expanded={expanded}
        className="home-list-item-row"
        onClick={() => onToggleExpand(home.homeId)}
        type="button"
      >
        <span className="home-list-item-icon">
          <FiHome size={18} />
        </span>
        <span className="home-list-item-body">
          <strong>{home.name}</strong>
          <span className="hint-text">
            {home.locationLabel ?? "No address set"} - {home.timezone ?? "Asia/Kolkata"}
          </span>
        </span>
        <span className="status-chip" data-status={home.allowed === false ? "failed" : "completed"}>
          {home.allowed === false ? "Not allowed" : home.role}
        </span>
        {expanded ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
      </button>
      {expanded ? (
        <div className="home-management-stack">
          <div className="button-row">
            <button className="secondary-button" onClick={() => onEdit(home)} type="button">Edit</button>
            <button className="secondary-button" onClick={() => onAddMember(home)} type="button">Add Member</button>
            {!home.isDefault ? (
              <button className="secondary-button" onClick={() => onDelete(home)} type="button">Delete</button>
            ) : null}
          </div>
          <section className="home-share-list">
            {shareCodes.length === 0 ? <p className="hint-text">No invitation codes created yet.</p> : null}
            {shareCodes.map((shareCode) => (
              <article className="home-share-card" key={shareCode.shareCodeId}>
                <strong>{shareCode.code}</strong>
                <span className="hint-text">{describeShareCodeStatus(shareCode, members)}</span>
              </article>
            ))}
          </section>
          <section className="home-member-list">
            {members.map((member) => (
              <article className="home-member-card" key={member.membershipId}>
                <div className="home-member-actions">
                  <div>
                    <strong>{member.name}</strong>
                    <p className="hint-text">{member.email} - {member.role}</p>
                  </div>
                  {member.role !== "owner" ? (
                    <button
                      className="secondary-button"
                      onClick={() => onToggleAllowed(member, member.allowed === false)}
                      type="button"
                    >
                      Allowed {member.allowed === false ? "OFF" : "ON"}
                    </button>
                  ) : (
                    <span className="status-chip" data-status="completed">Owner</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
      ) : null}
    </article>
  );
}
