import type { HomeMemberRecord } from "@jenix/shared";
import { FiChevronRight } from "react-icons/fi";

import { avatarColorFor, initials } from "../utils/avatar";

export interface HomeMemberRowProps {
  member: HomeMemberRecord;
  isSelf: boolean;
  manageable: boolean;
  onOpen: (member: HomeMemberRecord) => void;
}

export function HomeMemberRow({ member, isSelf, manageable, onOpen }: HomeMemberRowProps) {
  const blocked = member.allowed === false;
  const body = (
    <>
      <span className="avatar" style={{ background: avatarColorFor(member.userId) }}>
        {initials(member.name)}
      </span>
      <span className="settings-row-label">
        <strong>
          {member.name}
          {isSelf ? " (You)" : ""}
        </strong>
        <span>
          {member.email}
          {blocked ? " · access off" : ""}
        </span>
      </span>
      <span className="role-pill" data-role={member.role}>
        {member.role}
      </span>
      {manageable ? <FiChevronRight className="settings-row-chev" size={16} /> : null}
    </>
  );

  if (!manageable) {
    return (
      <article className="panel home-list-item">
        <div className="settings-row" data-blocked={blocked} style={{ cursor: "default" }}>
          {body}
        </div>
      </article>
    );
  }

  return (
    <article className="panel home-list-item">
      <button
        className="settings-row"
        data-blocked={blocked}
        onClick={() => onOpen(member)}
        type="button"
      >
        {body}
      </button>
    </article>
  );
}
