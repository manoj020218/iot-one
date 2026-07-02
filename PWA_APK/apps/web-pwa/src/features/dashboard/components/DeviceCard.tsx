import { useState } from "react";

import type { DashboardDevice } from "../services/dashboardApi";

export interface DeviceCardProps {
  device: DashboardDevice;
  onRename: (deviceId: string, displayName: string) => Promise<void>;
  onOpenDetails?: (deviceId: string) => void;
}

export function DeviceCard({
  device,
  onRename,
  onOpenDetails
}: DeviceCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.displayName);

  return (
    <article className="device-card">
      <div className="device-card-head">
        <div className="device-icon">{device.pidIconText}</div>
        <div>
          <p className="device-pid-label">{device.pidLabel}</p>
          <p className="device-pid-code">{device.pid}</p>
        </div>
      </div>
      {editing ? (
        <form
          className="rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onRename(device.deviceId, name).then(() => setEditing(false));
          }}
        >
          <label className="field">
            <span>Device Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="card-actions">
            <button className="primary-button" type="submit">
              Save Name
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setName(device.displayName);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <h3>{device.displayName}</h3>
          <p>{device.telemetryPreview}</p>
          <div className="card-actions">
            <span>{device.online ? "Online" : "Offline"}</span>
            <div className="button-row">
              {onOpenDetails ? (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => onOpenDetails(device.deviceId)}
                >
                  Details
                </button>
              ) : null}
              <button
                className="text-button"
                type="button"
                onClick={() => setEditing(true)}
              >
                Rename
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
