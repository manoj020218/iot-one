import { React } from "../host";
import { DEMO_STREAMER_DEVICES } from "../demoDevices";

interface DevicesPageProps {
  onOpenDevice: (deviceId: string) => void;
}

export function DevicesPage({ onOpenDevice }: DevicesPageProps) {
  return (
    <section>
      <p className="hint-text" style={{ marginBottom: 16 }}>
        Demo data — replace with GET /api/v1/streamer/devices once the VPS module ships
        (see VPS/API_CONTRACT.md §1).
      </p>
      <div className="content-grid">
        {DEMO_STREAMER_DEVICES.map((device) => (
          <article className="device-card" key={device.deviceId}>
            <div className="device-card-head">
              <div className="device-icon">SS</div>
              <div>
                <p className="device-pid-label">Smart Streamer</p>
                <p className="device-pid-code">{device.deviceId}</p>
              </div>
            </div>
            <div>
              <h3>{device.friendlyName}</h3>
              <p>{device.streamState}</p>
            </div>
            <div className="card-actions">
              <span>{device.onlineStatus === "online" ? "Online" : "Offline"}</span>
              <button className="text-button" onClick={() => onOpenDevice(device.deviceId)} type="button">
                Open Details
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
