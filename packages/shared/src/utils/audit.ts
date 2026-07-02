export interface AuditStampInput {
  actorId: string;
  action: string;
  occurredAt?: Date;
}

export interface AuditStamp {
  actorId: string;
  action: string;
  occurredAt: string;
}

export function createAuditStamp(input: AuditStampInput): AuditStamp {
  return {
    actorId: input.actorId,
    action: input.action,
    occurredAt: (input.occurredAt ?? new Date()).toISOString()
  };
}
