import type { DeviceRecord } from "@jenix/shared";

import type { DevicePidProfile } from "../services/deviceManagementApi";

export interface PidDynamicPageRendererProps {
  device: DeviceRecord;
  pidProfile: DevicePidProfile;
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
  pidProfile
}: PidDynamicPageRendererProps) {
  const pageIds =
    pidProfile.dashboard.dynamicPages.length > 0
      ? pidProfile.dashboard.dynamicPages
      : ["overview"];

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
