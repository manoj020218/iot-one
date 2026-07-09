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
          Live tank metrics will hydrate here once widget-level telemetry bindings are
          layered in. The backend telemetry path is already active for scenes and device
          liveness.
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
          Threshold automation is managed in the scene pipeline. Use this PID page to
          route operators toward the right automation surface.
        </p>
        <div className="card-actions">
          <span>Best paired with threshold-trigger scenes.</span>
          <span>Recommended next step: configure alerts in Scenes.</span>
        </div>
      </article>
    );
  }

  return (
    <article key={pageId} className="scene-card">
      <p className="scene-card-kicker">PID Dynamic Page</p>
      <h3>Unsupported Dynamic Page</h3>
      <p className="hint-text">
        No renderer is registered yet for <strong>{pageId}</strong>. The device page
        stays usable and surfaces this fallback instead of failing the route.
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
            <h3>UI Package Missing</h3>
            <p className="hint-text">
              The device is bound to remote-package mode, but no package artifact was
              resolved from HOME bootstrap.
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
