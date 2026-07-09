import {
  foundationPidBlueprint,
  type CreatePidInput,
  type ProductPidRecord
} from "@jenix/device-schemas";

const pidEndpoint = "/api/v1/admin/pids";
const requestHeaders = {
  "Content-Type": "application/json",
  "x-actor-id": "admin-ui",
  "x-role": "JENIX_DEVELOPER"
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now(): string {
  return new Date().toISOString();
}

function createDemoPidRecord(): ProductPidRecord {
  const timestamp = now();

  return {
    ...clone(foundationPidBlueprint),
    status: "beta",
    firmware: {
      ...clone(foundationPidBlueprint.firmware),
      stableVersion: "1.0.0"
    },
    createdBy: "admin-ui",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

let demoPidStore: ProductPidRecord[] = [createDemoPidRecord()];

function ensureNetworkFetch() {
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available");
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  return payload?.error ?? `Request failed with status ${response.status}`;
}

async function requestData<T>(
  path: string,
  init: RequestInit,
  fallback: () => Promise<T> | T
): Promise<T> {
  try {
    ensureNetworkFetch();
    const response = await fetch(`${pidEndpoint}${path}`, {
      ...init,
      headers: {
        ...requestHeaders,
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      if (response.status === 404 || response.status >= 500) {
        return await fallback();
      }

      throw new Error(await readErrorMessage(response));
    }

    const payload = (await response.json()) as { data: T };
    return payload.data;
  } catch (error) {
    if (error instanceof TypeError || error instanceof DOMException) {
      return await fallback();
    }

    if (error instanceof Error && /fetch is not available/i.test(error.message)) {
      return await fallback();
    }

    throw error;
  }
}

function findDemoPid(pid: string): ProductPidRecord {
  const record = demoPidStore.find((item) => item.pid === pid);

  if (!record) {
    throw new Error(`PID not found: ${pid}`);
  }

  return record;
}

export async function listPids(): Promise<ProductPidRecord[]> {
  return requestData(
    "/",
    {
      method: "GET"
    },
    () => clone(demoPidStore)
  );
}

export async function getPid(pid: string): Promise<ProductPidRecord> {
  return requestData(
    `/${encodeURIComponent(pid)}`,
    {
      method: "GET"
    },
    () => clone(findDemoPid(pid))
  );
}

export async function createPid(
  draft: CreatePidInput
): Promise<ProductPidRecord> {
  return requestData(
    "/",
    {
      method: "POST",
      body: JSON.stringify(draft)
    },
    () => {
      const timestamp = now();
      const record: ProductPidRecord = {
        ...clone(draft),
        pid: draft.pid.trim().toUpperCase(),
        createdBy: "admin-ui",
        createdAt: timestamp,
        updatedAt: timestamp
      };

      demoPidStore = [record, ...demoPidStore.filter((item) => item.pid !== record.pid)];
      return clone(record);
    }
  );
}

export async function updatePid(
  pid: string,
  patch: Partial<CreatePidInput>
): Promise<ProductPidRecord> {
  return requestData(
    `/${encodeURIComponent(pid)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch)
    },
    () => {
      const existing = findDemoPid(pid);

      if (existing.approvedAt || existing.status === "production") {
        throw new Error(`Approved production PID is immutable: ${pid}`);
      }

      const updated: ProductPidRecord = {
        ...clone(existing),
        ...clone(patch),
        hardware: {
          ...clone(existing.hardware),
          ...(patch.hardware ?? {})
        },
        firmware: {
          ...clone(existing.firmware),
          ...(patch.firmware ?? {})
        },
        matter: {
          ...clone(existing.matter),
          ...(patch.matter ?? {})
        },
        api: {
          ...clone(existing.api),
          ...(patch.api ?? {})
        },
        ui: {
          ...clone(existing.ui),
          ...(patch.ui ?? {})
        },
        dashboard: {
          ...clone(existing.dashboard),
          ...(patch.dashboard ?? {})
        },
        updatedAt: now()
      };

      demoPidStore = demoPidStore.map((item) =>
        item.pid === pid ? updated : item
      );
      return clone(updated);
    }
  );
}

export async function approvePid(pid: string): Promise<ProductPidRecord> {
  return requestData(
    `/${encodeURIComponent(pid)}/approve`,
    {
      method: "POST"
    },
    () => {
      const existing = findDemoPid(pid);
      const updated: ProductPidRecord = {
        ...clone(existing),
        status: "production",
        approvedAt: now(),
        approvedBy: "admin-ui",
        updatedAt: now()
      };

      demoPidStore = demoPidStore.map((item) =>
        item.pid === pid ? updated : item
      );
      return clone(updated);
    }
  );
}

export async function archivePid(pid: string): Promise<ProductPidRecord> {
  return requestData(
    `/${encodeURIComponent(pid)}/archive`,
    {
      method: "POST"
    },
    () => {
      const existing = findDemoPid(pid);
      const updated: ProductPidRecord = {
        ...clone(existing),
        status: "discontinued",
        updatedAt: now()
      };

      demoPidStore = demoPidStore.map((item) =>
        item.pid === pid ? updated : item
      );
      return clone(updated);
    }
  );
}

export const pidApiTesting = {
  resetDemoStore() {
    demoPidStore = [createDemoPidRecord()];
  }
};
