import { React } from "../host";
import { DEMO_STREAMER_DEVICES } from "../demoDevices";

/**
 * Deliberately does NOT reimplement a firmware panel. Per
 * VPS/API_CONTRACT.md §7: "Do not build new endpoints... reuse
 * DeviceFirmwarePanel.tsx exactly as it works for every other device
 * type." That component lives in the core platform (web-pwa), which this
 * separately-built plugin has no access to at build time — and doesn't
 * need to, since Smart Streamer devices are ordinary DeviceRecords that
 * already get the generic Firmware panel on their standard Device Details
 * page. This page's only job is the one genuinely Smart-Streamer-specific
 * fact that panel wouldn't otherwise know: whether an active stream is
 * blocking the update right now.
 */
export function OtaPage() {
  return (
    <section>
      <article className="panel" style={{ marginBottom: 16 }}>
        <p className="hint-text">
          Firmware updates for Smart Streamer devices use the platform&apos;s existing OTA
          system — the same rollout, staging, and rollback flow every other Jenix device
          uses. There is no separate Smart Streamer update flow to learn.
        </p>
      </article>

      <div className="content-grid">
        {DEMO_STREAMER_DEVICES.map((device) => {
          const blocked = device.streamState === "STREAMING";
          return (
            <article className="device-card" key={device.deviceId}>
              <div className="device-card-head">
                <div className="device-icon">FW</div>
                <div>
                  <p className="device-pid-label">Firmware {device.firmwareVersion}</p>
                  <p className="device-pid-code">{device.deviceId}</p>
                </div>
              </div>
              <div>
                <h3>{device.friendlyName}</h3>
                <p>
                  {blocked
                    ? "Stop the active stream before updating firmware."
                    : "Available for update — no active stream."}
                </p>
              </div>
              <div className="card-actions">
                <span>{blocked ? "Update blocked" : "Update allowed"}</span>
                <a className="text-button" href={`/devices/${device.deviceId}`}>
                  Manage Firmware
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
