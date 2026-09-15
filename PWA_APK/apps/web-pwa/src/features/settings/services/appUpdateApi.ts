import packageJson from "../../../../package.json";
import { apiOrigin } from "../../../app/apiOrigin";

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
    // A relative path here resolves against the WebView's own origin inside
    // the native app -- which serves this same build's bundled assets, not
    // a live copy on the server. That made this check compare the app to
    // itself: whatever version shipped in THIS install always "matched"
    // because it was reading its own frozen snapshot, never a newer one
    // published later. apiOrigin ("" on the hosted web PWA, the real host
    // inside Capacitor) plus the PWA's own "/app/" mount point (see
    // one.jenix.in.conf) is what actually reaches the live file either way.
    const releaseUrl = apiOrigin
      ? `${apiOrigin}/app/app-release.json?ts=${Date.now()}`
      : `${import.meta.env.BASE_URL}app-release.json?ts=${Date.now()}`;
    const response = await fetch(releaseUrl);
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
