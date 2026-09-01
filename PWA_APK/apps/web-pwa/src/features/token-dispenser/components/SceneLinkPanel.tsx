import { useNavigate } from "react-router-dom";
import { SCENE_CAPABILITIES } from "../types";

interface Props {
  deviceId: string;
}

export function SceneLinkPanel({ deviceId }: Props) {
  const navigate = useNavigate();
  void deviceId; // available for future scene pre-fill

  return (
    <article className="scene-card">
      <p className="scene-card-kicker">Scene Integration</p>
      <h3 style={{ margin: 0 }}>Automation Capabilities</h3>
      <p className="hint-text" style={{ margin: 0 }}>
        Wire this device to the Scene engine to automate queue workflows.
      </p>

      <div className="content-grid">
        <div>
          <p className="eyebrow" style={{ marginBottom: 0 }}>Triggers</p>
          <ul className="td-cap-list">
            {SCENE_CAPABILITIES.triggers.map((t) => (
              <li key={t} className="td-cap-item">{t}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="eyebrow" style={{ marginBottom: 0 }}>Actions</p>
          <ul className="td-cap-list">
            {SCENE_CAPABILITIES.actions.map((a) => (
              <li key={a} className="td-cap-item">{a}</li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="eyebrow" style={{ marginBottom: 6 }}>Readable Values</p>
        <div className="button-row">
          {SCENE_CAPABILITIES.readableValues.map((v) => (
            <span key={v} className="status-chip">{v}</span>
          ))}
        </div>
      </div>

      <div className="button-row">
        <button
          className="secondary-button"
          onClick={() => navigate("/scenes/new")}
        >
          Use in Scene
        </button>
        <button className="text-button" onClick={() => navigate("/scenes")}>
          View All Scenes →
        </button>
      </div>
    </article>
  );
}
