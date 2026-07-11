import type { HomeMemberRecord, HomeRecord, HomeShareCodeRecord } from "@jenix/shared";

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

function describeShareCodeStatus(shareCode: HomeShareCodeRecord): string {
  if (shareCode.redeemedByUserId) {
    return `Accepted by ${shareCode.redeemedByUserId}`;
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
    <article className="panel">
      <div className="home-card-head">
        <div>
          <strong>{home.name}</strong>
          <p className="hint-text">
            {home.locationLabel ?? "Location not captured"} - {home.timezone ?? "Asia/Kolkata"}
          </p>
        </div>
        <span className="status-chip" data-status={home.allowed === false ? "failed" : "completed"}>
          {home.allowed === false ? "Not allowed" : home.role}
        </span>
      </div>
      <div className="button-row">
        <button className="secondary-button" onClick={() => onEdit(home)} type="button">Edit</button>
        <button className="secondary-button" onClick={() => onAddMember(home)} type="button">Add Member</button>
        <button className="secondary-button" onClick={() => onToggleExpand(home.homeId)} type="button">
          {expanded ? "Hide Access" : "View Access"}
        </button>
        {!home.isDefault ? (
          <button className="secondary-button" onClick={() => onDelete(home)} type="button">Delete</button>
        ) : null}
      </div>
      {expanded ? (
        <div className="home-management-stack">
          <section className="home-share-list">
            {shareCodes.length === 0 ? <p className="hint-text">No invitation codes created yet.</p> : null}
            {shareCodes.map((shareCode) => (
              <article className="home-share-card" key={shareCode.shareCodeId}>
                <strong>{shareCode.code}</strong>
                <span className="hint-text">{describeShareCodeStatus(shareCode)}</span>
              </article>
            ))}
          </section>
          <section className="home-member-list">
            {members.map((member) => (
              <article className="home-member-card" key={member.membershipId}>
                <div className="home-member-actions">
                  <div>
                    <strong>{member.name}</strong>
                    <p className="hint-text">{member.userId} - {member.role}</p>
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
