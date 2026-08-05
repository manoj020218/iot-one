import type { AuthSession, HomeUiBootstrapPackageRecord } from "@jenix/shared";
import { useEffect, useState } from "react";

import { resolveDevicePackageComponent } from "./devicePackageRegistry";
import type { RemoteProductPackageComponent } from "./remoteProductPackage.types";

export interface RemoteProductMountProps {
  packageRecord: HomeUiBootstrapPackageRecord;
  session: AuthSession;
  homeId: string;
}

/**
 * Mounts a whole remote product plugin (its own internal navigation,
 * multiple sections) at wherever this is placed in the route tree — e.g.
 * <Route path="/streamer/*" element={<RemoteProductMount .../>} />.
 *
 * Generic on purpose: any future full-surface plugin (P10 Display, SOS
 * Siren, etc.) reuses this exact component with a different packageRecord,
 * the same way every per-device card reuses PidDynamicPageRenderer.
 */
export function RemoteProductMount({ packageRecord, session, homeId }: RemoteProductMountProps) {
  const [Remote, setRemote] = useState<RemoteProductPackageComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setRemote(null);

    void resolveDevicePackageComponent<RemoteProductPackageComponent>(packageRecord)
      .then((component) => {
        if (active) {
          setRemote(() => component);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load plugin");
        }
      });

    return () => {
      active = false;
    };
  }, [packageRecord.packageId, packageRecord.version, packageRecord.entryPath]);

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <article className="panel">
          <p className="hint-text">This section couldn&apos;t be loaded: {error}</p>
        </article>
      </div>
    );
  }

  if (!Remote) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--faint)" }}>
        Loading…
      </div>
    );
  }

  return <Remote session={session} homeId={homeId} />;
}
