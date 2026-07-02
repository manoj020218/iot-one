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
      description="Phase 7 adds an operator-grade scene builder for device threshold alerts, scheduled automations, and controlled manual runs."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div>
          <span className="eyebrow">Active HOME</span>
          <h2>{currentHome.name}</h2>
          <p>Signed in as {session.user.name}</p>
        </div>
        <div className="top-bar-meta">
          <button
            className="text-button"
            onClick={() => navigate("/dashboard")}
            type="button"
          >
            Back to Dashboard
          </button>
          <button
            className="primary-button"
            onClick={() => navigate("/scenes/new")}
            type="button"
          >
            + Create Scene
          </button>
        </div>
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
