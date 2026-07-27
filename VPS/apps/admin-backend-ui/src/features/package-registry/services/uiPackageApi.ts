import type {
  AddUiPackageVersionInput,
  CreateUiPackageInput,
  UiPackageRecord
} from "@jenix/shared";

const uiPackageEndpoint = "/api/v1/admin/ui-packages";
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

function createDemoPackageStore(): UiPackageRecord[] {
  const timestamp = "2026-07-09T00:00:00.000Z";

  return [
    {
      packageId: "tank-guard-mobile",
      pid: "JNX-TG-C3-001",
      displayName: "Tank Guard remote UI",
      versions: [
        {
          version: "1.0.0",
          manifestPath: "/ui-packages/tank-guard-mobile/1.0.0/manifest.json",
          entryPath: "/ui-packages/tank-guard-mobile/1.0.0/remoteEntry.js",
          exportName: "TankGuardDynamicPage",
          status: "published",
          createdAt: timestamp,
          createdBy: "system-seed",
          publishedAt: timestamp,
          publishedBy: "system-seed"
        }
      ],
      createdAt: timestamp,
      createdBy: "system-seed",
      updatedAt: timestamp
    }
  ];
}

let demoPackageStore: UiPackageRecord[] = createDemoPackageStore();

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
    const response = await fetch(`${uiPackageEndpoint}${path}`, {
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

function findDemoPackage(packageId: string): UiPackageRecord {
  const record = demoPackageStore.find((item) => item.packageId === packageId);

  if (!record) {
    throw new Error(`UI package not found: ${packageId}`);
  }

  return record;
}

export async function listUiPackages(): Promise<UiPackageRecord[]> {
  return requestData("/", { method: "GET" }, () => clone(demoPackageStore));
}

export async function getUiPackage(packageId: string): Promise<UiPackageRecord> {
  return requestData(`/${encodeURIComponent(packageId)}`, { method: "GET" }, () =>
    clone(findDemoPackage(packageId))
  );
}

export async function registerUiPackage(
  input: CreateUiPackageInput
): Promise<UiPackageRecord> {
  return requestData(
    "/",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    () => {
      if (demoPackageStore.some((item) => item.packageId === input.packageId)) {
        throw new Error(`UI package already exists: ${input.packageId}`);
      }

      const timestamp = now();
      const record: UiPackageRecord = {
        packageId: input.packageId,
        pid: input.pid,
        displayName: input.displayName,
        versions: [
          {
            version: input.version,
            manifestPath: input.manifestPath,
            entryPath: input.entryPath,
            exportName: input.exportName,
            status: input.publishImmediately ? "published" : "draft",
            createdAt: timestamp,
            createdBy: "admin-ui",
            ...(input.integrity ? { integrity: input.integrity } : {}),
            ...(input.publishImmediately
              ? { publishedAt: timestamp, publishedBy: "admin-ui" }
              : {})
          }
        ],
        createdAt: timestamp,
        createdBy: "admin-ui",
        updatedAt: timestamp
      };

      demoPackageStore = [record, ...demoPackageStore];
      return clone(record);
    }
  );
}

export async function addUiPackageVersion(
  packageId: string,
  input: AddUiPackageVersionInput
): Promise<UiPackageRecord> {
  return requestData(
    `/${encodeURIComponent(packageId)}/versions`,
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    () => {
      const existing = findDemoPackage(packageId);
      const timestamp = now();
      const versions = input.publishImmediately
        ? existing.versions.map((entry) =>
            entry.status === "published"
              ? { ...entry, status: "deprecated" as const, deprecatedAt: timestamp }
              : entry
          )
        : existing.versions;

      const updated: UiPackageRecord = {
        ...existing,
        versions: [
          ...versions,
          {
            version: input.version,
            manifestPath: input.manifestPath,
            entryPath: input.entryPath,
            exportName: input.exportName,
            status: input.publishImmediately ? "published" : "draft",
            createdAt: timestamp,
            createdBy: "admin-ui",
            ...(input.integrity ? { integrity: input.integrity } : {}),
            ...(input.publishImmediately
              ? { publishedAt: timestamp, publishedBy: "admin-ui" }
              : {})
          }
        ],
        updatedAt: timestamp
      };

      demoPackageStore = demoPackageStore.map((item) =>
        item.packageId === packageId ? updated : item
      );
      return clone(updated);
    }
  );
}

export async function publishUiPackageVersion(
  packageId: string,
  version: string
): Promise<UiPackageRecord> {
  return requestData(
    `/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(version)}/publish`,
    { method: "POST" },
    () => {
      const existing = findDemoPackage(packageId);
      const timestamp = now();
      const updated: UiPackageRecord = {
        ...existing,
        versions: existing.versions.map((entry) => {
          if (entry.version === version) {
            return {
              ...entry,
              status: "published" as const,
              publishedAt: timestamp,
              publishedBy: "admin-ui"
            };
          }
          if (entry.status === "published") {
            return { ...entry, status: "deprecated" as const, deprecatedAt: timestamp };
          }
          return entry;
        }),
        updatedAt: timestamp
      };

      demoPackageStore = demoPackageStore.map((item) =>
        item.packageId === packageId ? updated : item
      );
      return clone(updated);
    }
  );
}

export async function deprecateUiPackageVersion(
  packageId: string,
  version: string
): Promise<UiPackageRecord> {
  return requestData(
    `/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(version)}/deprecate`,
    { method: "POST" },
    () => {
      const existing = findDemoPackage(packageId);
      const timestamp = now();
      const updated: UiPackageRecord = {
        ...existing,
        versions: existing.versions.map((entry) =>
          entry.version === version
            ? { ...entry, status: "deprecated" as const, deprecatedAt: timestamp }
            : entry
        ),
        updatedAt: timestamp
      };

      demoPackageStore = demoPackageStore.map((item) =>
        item.packageId === packageId ? updated : item
      );
      return clone(updated);
    }
  );
}

export async function rollbackUiPackage(
  packageId: string,
  version: string
): Promise<UiPackageRecord> {
  return requestData(
    `/${encodeURIComponent(packageId)}/rollback`,
    {
      method: "POST",
      body: JSON.stringify({ version })
    },
    () => {
      const existing = findDemoPackage(packageId);
      const timestamp = now();
      const updated: UiPackageRecord = {
        ...existing,
        versions: existing.versions.map((entry) => {
          if (entry.version === version) {
            const { deprecatedAt: _deprecatedAt, ...rest } = entry;
            return {
              ...rest,
              status: "published" as const,
              publishedAt: timestamp,
              publishedBy: "admin-ui"
            };
          }
          if (entry.status === "published") {
            return { ...entry, status: "deprecated" as const, deprecatedAt: timestamp };
          }
          return entry;
        }),
        updatedAt: timestamp
      };

      demoPackageStore = demoPackageStore.map((item) =>
        item.packageId === packageId ? updated : item
      );
      return clone(updated);
    }
  );
}

export const uiPackageApiTesting = {
  resetDemoStore() {
    demoPackageStore = createDemoPackageStore();
  }
};
