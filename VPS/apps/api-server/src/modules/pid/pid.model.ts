import type { ProductPidRecord } from "@jenix/device-schemas";

import type { PidAuditLogRecord, PidModuleState } from "./pid.types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const pidStore = new Map<string, ProductPidRecord>();
const pidAuditLogStore: PidAuditLogRecord[] = [];

export const pidRepository = {
  list(): ProductPidRecord[] {
    return Array.from(pidStore.values(), (pid) => clone(pid));
  },

  get(pid: string): ProductPidRecord | undefined {
    const record = pidStore.get(pid);
    return record ? clone(record) : undefined;
  },

  save(record: ProductPidRecord): ProductPidRecord {
    pidStore.set(record.pid, clone(record));
    return clone(record);
  },

  appendAuditLog(entry: PidAuditLogRecord): void {
    pidAuditLogStore.push(clone(entry));
  },

  listAuditLogs(pid?: string): PidAuditLogRecord[] {
    const entries = pid
      ? pidAuditLogStore.filter((entry) => entry.pid === pid)
      : pidAuditLogStore;

    return clone(entries);
  },

  reset(): void {
    pidStore.clear();
    pidAuditLogStore.length = 0;
  },

  snapshot(): PidModuleState {
    return {
      pids: this.list(),
      auditLogs: this.listAuditLogs()
    };
  }
};
