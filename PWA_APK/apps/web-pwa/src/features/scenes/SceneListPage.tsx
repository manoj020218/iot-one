import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getCurrentHome } from "../dashboard/services/dashboardApi";
import { SceneCard } from "./components/SceneCard";
import { useScenes } from "./hooks/useScenes";

export function SceneListPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("SceneListPage requires an authenticated session");
  }

  const currentHome = getCurrentHome(session);
  const { scenes, loading, error } = useScenes(session);

  return (
    <AppShell
      eyebrow="Scenes"
      title="Automation scenes"
      description="Automate your devices with scheduled routines, alerts, and one-tap scenes."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div>
          <h2>Your scenes</h2>
        </div>
        <button
          className="primary-button"
          onClick={() => navigate("/scenes/new")}
          type="button"
        >
          + Create Scene
        </button>
      </section>
      {loading ? <section className="panel">Loading scene catalog...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading && !error && scenes.length === 0 ? (
        <section className="empty-state">
          <h2>No scenes yet</h2>
          <p>
            Start with a manual test scene or a threshold-driven notification for the
            first device rollout.
          </p>
          <button
            className="primary-button"
            onClick={() => navigate("/scenes/new")}
            type="button"
          >
            Build the first scene
          </button>
        </section>
      ) : null}
      {!loading && scenes.length > 0 ? (
        <section className="scene-grid">
          {scenes.map((scene) => (
            <SceneCard
              key={scene.sceneId}
              scene={scene}
              onOpen={(currentSceneId) => navigate(`/scenes/${currentSceneId}`)}
            />
          ))}
        </section>
      ) : null}
    </AppShell>
  );
}
