import type { HomeMemberRecord, HomeShareCodeRecord } from "@jenix/shared";

import { Sheet } from "../../../app/components/Sheet";

export interface AddMemberSheetProps {
  open: boolean;
  featuredCode: HomeShareCodeRecord | null;
  otherCodes: HomeShareCodeRecord[];
  members: HomeMemberRecord[];
  generating: boolean;
  onClose: () => void;
  onGenerateAnother: () => void;
  onCopy: (code: HomeShareCodeRecord) => void;
  onShare: (code: HomeShareCodeRecord) => void;
}

function describeShareCodeStatus(
  shareCode: HomeShareCodeRecord,
  members: HomeMemberRecord[]
): string {
  if (shareCode.redeemedByUserId) {
    const redeemedBy = members.find((member) => member.userId === shareCode.redeemedByUserId);
    return `Accepted by ${redeemedBy?.name ?? redeemedBy?.email ?? "a new member"}`;
  }

  const timeLeftMs = new Date(shareCode.expiresAt).getTime() - Date.now();
  if (timeLeftMs <= 0) {
    return "Expired";
  }

  const minutes = Math.max(1, Math.ceil(timeLeftMs / 60_000));
  return `Waiting for acceptance — ${minutes} min left`;
}

export function AddMemberSheet({
  open,
  featuredCode,
  otherCodes,
  members,
  generating,
  onClose,
  onGenerateAnother,
  onCopy,
  onShare
}: AddMemberSheetProps) {
  return (
    <Sheet
      onClose={onClose}
      open={open}
      subtitle="Share this code — it grants Member access for 1 hour."
      title="Invite a member"
    >
      {featuredCode ? (
        <div className="invite-code-card">
          <div className="invite-code">{featuredCode.code}</div>
          <div className="invite-code-meta">{describeShareCodeStatus(featuredCode, members)}</div>
        </div>
      ) : (
        <p className="hint-text">Generating an invitation code...</p>
      )}
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={!featuredCode}
          onClick={() => featuredCode && onCopy(featuredCode)}
          type="button"
        >
          Copy code
        </button>
        <button
          className="primary-button"
          disabled={!featuredCode}
          onClick={() => featuredCode && onShare(featuredCode)}
          type="button"
        >
          Share
        </button>
      </div>
      <button
        className="secondary-button"
        disabled={generating}
        onClick={onGenerateAnother}
        style={{ width: "100%" }}
        type="button"
      >
        {generating ? "Generating..." : "Generate another code"}
      </button>
      {otherCodes.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <span className="eyebrow">Other invitations</span>
          {otherCodes.map((code) => (
            <div className="pending-row" key={code.shareCodeId}>
              <strong>{code.code}</strong>
              <span>{describeShareCodeStatus(code, members)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </Sheet>
  );
}
