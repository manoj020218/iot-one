import packageJson from "../../../../package.json";

export interface AppUpdateStatus {
  currentVersion: string;
  latestVersion: string;
  channel: string;
  updatedAt: string;
  hasUpdate: boolean;
  notes?: string;
  downloadUrl?: string;
}

interface PublishedRelease {
  version: string;
  channel: string;
  updatedAt: string;
  notes?: string;
  downloadUrl?: string;
}

export async function getAppUpdateStatus(): Promise<AppUpdateStatus> {
  const currentVersion = packageJson.version;

  try {
    const response = await fetch(`/app-release.json?ts=${Date.now()}`);
    const published = (await response.json()) as PublishedRelease;

    return {
      currentVersion,
      latestVersion: published.version,
      channel: published.channel,
      updatedAt: published.updatedAt,
      hasUpdate: published.version !== currentVersion,
      ...(published.notes ? { notes: published.notes } : {}),
      ...(published.downloadUrl ? { downloadUrl: published.downloadUrl } : {})
    };
  } catch {
    return {
      currentVersion,
      latestVersion: currentVersion,
      channel: "preview",
      updatedAt: new Date().toISOString().slice(0, 10),
      hasUpdate: false,
      notes: "The current web shell is already up to date."
    };
  }
}

export async function applyAvailableUpdate(status: AppUpdateStatus): Promise<string> {
  if (!status.hasUpdate) {
    return "You are already using the latest app build.";
  }

  if (status.downloadUrl) {
    window.location.assign(status.downloadUrl);
    return `Downloading ${status.latestVersion}.`;
  }

  window.location.reload();
  return `Refreshing into ${status.latestVersion}.`;
}
