import type {
  DeviceRecord,
  DeviceUiCommandRequest,
  DeviceUiRuntimeState,
  HomeUiBootstrapDeviceBinding,
  HomeUiBootstrapPackageRecord
} from "@jenix/shared";
import { useEffect, useState } from "react";

import { resolveDevicePackageComponent } from "../plugins/devicePackageRegistry";
import type { DevicePackageComponent } from "../plugins/devicePackage.types";
import type { DevicePidProfile } from "../services/deviceManagementApi";

export interface PidDynamicPageRendererProps {
  device: DeviceRecord;
  pidProfile: DevicePidProfile;
  uiBinding: HomeUiBootstrapDeviceBinding | undefined;
  uiPackage: HomeUiBootstrapPackageRecord | undefined;
  runtime: DeviceUiRuntimeState | null | undefined;
  busy?: boolean | undefined;
  onRefresh: () => Promise<void>;
  onCommand: (input: DeviceUiCommandRequest) => Promise<void>;
}

function renderKnownDynamicPage(pageId: string, device: DeviceRecord) {
  if (pageId === "tank-level") {
    return (
      <article key={pageId} className="scene-card">
        <p className="scene-card-kicker">PID Dynamic Page</p>
        <h3>Tank Level</h3>
        <p className="hint-text">
          Live tank readings for this device will appear here as new telemetry arrives.
        </p>
        <dl className="summary-grid">
          <div>
            <dt>Last Seen</dt>
            <dd>{device.lastSeenAt ?? "Waiting for telemetry"}</dd>
          </div>
          <div>
            <dt>Cloud</dt>
            <dd>{device.cloudStatus}</dd>
          </div>
          <div>
            <dt>MQTT</dt>
            <dd>{device.mqttStatus}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>{device.localStatus ?? "unknown"}</dd>
          </div>
        </dl>
      </article>
    );
  }

  if (pageId === "thresholds") {
    return (
      <article key={pageId} className="scene-card">
        <p className="scene-card-kicker">PID Dynamic Page</p>
        <h3>Thresholds</h3>
        <p className="hint-text">
          Set alert thresholds for this device from the Scenes tab.
        </p>
        <div className="card-actions">
          <span>Get notified when a reading crosses a limit you set.</span>
        </div>
      </article>
    );
  }

  return (
    <article key={pageId} className="scene-card">
      <p className="scene-card-kicker">PID Dynamic Page</p>
      <h3>Control Screen Not Available</h3>
      <p className="hint-text">
        A dedicated <strong>{pageId}</strong> control screen isn't available for this
        device yet.
      </p>
    </article>
  );
}

export function PidDynamicPageRenderer({
  device,
  pidProfile,
  uiBinding,
  uiPackage,
  runtime,
  busy,
  onRefresh,
  onCommand
}: PidDynamicPageRendererProps) {
  const [RemoteComponent, setRemoteComponent] = useState<DevicePackageComponent | null>(
    null
  );
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const pageIds =
    pidProfile.dashboard.dynamicPages.length > 0
      ? pidProfile.dashboard.dynamicPages
      : ["overview"];

  useEffect(() => {
    if (uiBinding?.uiMode !== "remote-package" || !uiPackage) {
      setRemoteComponent(null);
      setRemoteError(null);
      return;
    }

    let active = true;

    setRemoteError(null);
    void resolveDevicePackageComponent(uiPackage)
      .then((component) => {
        if (active) {
          setRemoteComponent(() => component);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRemoteError(error instanceof Error ? error.message : "Failed to load UI package");
        }
      });

    return () => {
      active = false;
    };
  }, [uiBinding?.uiMode, uiPackage]);

  if (uiBinding?.uiMode === "remote-package") {
    if (!uiPackage) {
      return (
        <section className="content-grid">
          <article className="scene-card">
            <p className="scene-card-kicker">PID Dynamic Page</p>
            <h3>Control Screen Unavailable</h3>
            <p className="hint-text">
              This device's control screen couldn't be loaded. Try refreshing, or check
              back after your next app update.
            </p>
          </article>
        </section>
      );
    }

    if (remoteError) {
      return (
        <section className="content-grid">
          <article className="scene-card">
            <p className="scene-card-kicker">PID Dynamic Page</p>
            <h3>Package Load Failed</h3>
            <p className="hint-text">{remoteError}</p>
          </article>
        </section>
      );
    }

    if (!RemoteComponent || !runtime) {
      return <section className="panel">Loading device package...</section>;
    }

    return (
      <RemoteComponent
        busy={busy}
        device={device}
        pidProfile={pidProfile}
        runtime={runtime}
        onRefresh={onRefresh}
        onCommand={onCommand}
      />
    );
  }

  return (
    <section className="content-grid">
      {pageIds.map((pageId) =>
        pageId === "overview" ? (
          <article key={pageId} className="scene-card">
            <p className="scene-card-kicker">PID Dynamic Page</p>
            <h3>Overview</h3>
            <p className="hint-text">
              This PID does not define custom dynamic pages yet. The summary and firmware
              panels remain available as the safe default detail view.
            </p>
          </article>
        ) : (
          renderKnownDynamicPage(pageId, device)
        )
      )}
    </section>
  );
}
