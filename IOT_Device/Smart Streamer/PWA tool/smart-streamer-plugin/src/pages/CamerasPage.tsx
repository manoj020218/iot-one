import { React } from "../host";
import { DEMO_STREAMER_CAMERAS } from "../demoCameras";

interface CamerasPageProps {
  onOpenCamera: (cameraId: string) => void;
  onAddCamera: () => void;
}

export function CamerasPage({ onOpenCamera, onAddCamera }: CamerasPageProps) {
  return (
    <section>
      <div className="scene-section-head" style={{ marginBottom: 16 }}>
        <div>
          <p className="hint-text">
            Demo data — replace with GET /api/v1/streamer/cameras once the VPS module ships
            (see VPS/API_CONTRACT.md §2).
          </p>
        </div>
        <button className="primary-button" onClick={onAddCamera} type="button">
          Add Camera
        </button>
      </div>
      <div className="content-grid">
        {DEMO_STREAMER_CAMERAS.map((camera) => (
          <article className="device-card" key={camera.cameraId}>
            <div className="device-card-head">
              <div className="device-icon">CAM</div>
              <div>
                <p className="device-pid-label">{camera.videoCodec} / {camera.audioCodec}</p>
                <p className="device-pid-code">{camera.cameraId}</p>
              </div>
            </div>
            <div>
              <h3>{camera.friendlyName}</h3>
              <p>
                rtsp://{camera.rtspHost}:{camera.rtspPort}{camera.rtspPath}
              </p>
            </div>
            <dl className="summary-grid">
              <div>
                <dt>Transport</dt>
                <dd>{camera.transport.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Assigned Device</dt>
                <dd>{camera.assignedDeviceId ?? "Unassigned"}</dd>
              </div>
            </dl>
            <div className="card-actions">
              <button className="text-button" onClick={() => onOpenCamera(camera.cameraId)} type="button">
                Edit &amp; Test
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
