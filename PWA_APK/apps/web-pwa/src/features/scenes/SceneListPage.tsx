import { AppShell, StatusPill } from "@jenix/ui";
import { useCallback, useMemo, useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import type { SceneRecord } from "@jenix/shared";

import { Sheet } from "../../app/components/Sheet";
import { useAuth } from "../auth/hooks/useAuth";
import { getCurrentHome } from "../dashboard/services/dashboardApi";
import { SceneRuleRow } from "./components/SceneRuleRow";
import { SceneRunCard } from "./components/SceneRunCard";
import { useScenes } from "./hooks/useScenes";
import { runSceneManually, updateScene } from "./services/sceneApi";
import { classifySceneRecord } from "./services/sceneKind";

type SceneTab = "run" | "automation";

export function SceneListPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<SceneTab>("run");
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  if (!session) {
    throw new Error("SceneListPage requires an authenticated session");
  }

  const authSession = session;
  const currentHome = getCurrentHome(authSession);
  const { scenes, loading, error, reload } = useScenes(authSession);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  const runScenes = useMemo(
    () => scenes.filter((scene) => classifySceneRecord(scene) === "run"),
    [scenes]
  );
  const automationScenes = useMemo(
    () => scenes.filter((scene) => classifySceneRecord(scene) === "automation"),
    [scenes]
  );

  async function handleRun(scene: SceneRecord) {
    try {
      const result = await runSceneManually(authSession, scene.sceneId, {});
      await reload();
      showToast(
        result.matchedConditions
          ? `${scene.name} ran (${result.executedActions.length} action${
              result.executedActions.length === 1 ? "" : "s"
            })`
          : `${scene.name} did not run — conditions not met`
      );
    } catch (runError) {
      showToast(runError instanceof Error ? runError.message : `Unable to run ${scene.name}`);
    }
  }

  async function handleToggle(scene: SceneRecord, active: boolean) {
    try {
      await updateScene(authSession, scene.sceneId, {
        status: active ? "active" : "paused"
      });
      await reload();
    } catch (toggleError) {
      showToast(
        toggleError instanceof Error ? toggleError.message : `Unable to update ${scene.name}`
      );
    }
  }

  return (
    <AppShell
      eyebrow="Scenes"
      title="Smart"
      description="Tap-to-Run scenes fire instantly. Automations run themselves when their conditions match."
      aside={
        <div className="top-bar-meta">
          <StatusPill label={currentHome.name} tone="neutral" />
          <button
            aria-label="New scene"
            className="devices-add-button"
            onClick={() => setAddOpen(true)}
            type="button"
          >
            <FiPlus size={20} />
          </button>
        </div>
      }
    >
      <div className="segmented" role="tablist">
        <button
          data-active={tab === "run"}
          onClick={() => setTab("run")}
          role="tab"
          type="button"
        >
          Tap-to-Run
        </button>
        <button
          data-active={tab === "automation"}
          onClick={() => setTab("automation")}
          role="tab"
          type="button"
        >
          Automation
        </button>
      </div>

      {loading ? <section className="panel" style={{ marginTop: 16 }}>Loading scenes...</section> : null}
      {error ? <section className="panel" style={{ marginTop: 16 }}>{error}</section> : null}

      {!loading && !error && tab === "run" ? (
        <section style={{ display: "grid", gap: 14, marginTop: 16 }}>
          {runScenes.length === 0 ? (
            <div className="empty-state">
              <h2>No tap-to-run scenes yet</h2>
              <p>
                Build a one-tap scene for the actions you run most — no conditions, no
                waiting.
              </p>
              <button className="primary-button" onClick={() => setAddOpen(true)} type="button">
                Create a scene
              </button>
            </div>
          ) : (
            <div className="run-grid">
              {runScenes.map((scene) => (
                <SceneRunCard
                  key={scene.sceneId}
                  scene={scene}
                  onRun={() => handleRun(scene)}
                  onEdit={(sceneId) => navigate(`/scenes/${sceneId}`)}
                />
              ))}
              <button
                className="add-run-card"
                onClick={() => navigate("/scenes/new?kind=run")}
                type="button"
              >
                <FiPlus size={18} />
                <span>New scene</span>
              </button>
            </div>
          )}
          <p className="hint-text">
            Tap a scene to run every action in it immediately. Use the ••• menu to edit it.
          </p>
        </section>
      ) : null}

      {!loading && !error && tab === "automation" ? (
        <section style={{ display: "grid", gap: 10, marginTop: 16 }}>
          {automationScenes.length === 0 ? (
            <div className="empty-state">
              <h2>No automations yet</h2>
              <p>
                Automations watch a schedule or a device reading and run on their own —
                like alerting when a tank runs high.
              </p>
              <button
                className="primary-button"
                onClick={() => navigate("/scenes/new?kind=automation")}
                type="button"
              >
                Build the first automation
              </button>
            </div>
          ) : (
            <>
              {automationScenes.map((scene) => (
                <SceneRuleRow
                  key={scene.sceneId}
                  scene={scene}
                  onOpen={(sceneId) => navigate(`/scenes/${sceneId}`)}
                  onToggle={(_sceneId, active) => handleToggle(scene, active)}
                />
              ))}
              <button
                className="add-rule-row"
                onClick={() => navigate("/scenes/new?kind=automation")}
                type="button"
              >
                <FiPlus size={16} />
                New automation
              </button>
            </>
          )}
          <p className="hint-text">
            The switch enables or disables an automation without opening it.
          </p>
        </section>
      ) : null}

      <Sheet
        onClose={() => setAddOpen(false)}
        open={addOpen}
        title="New scene"
        subtitle="Choose what kind of scene to build."
      >
        <div className="scene-kind-sheet">
          <button
            className="scene-kind-option"
            onClick={() => navigate("/scenes/new?kind=run")}
            type="button"
          >
            <span className="rule-icon" style={{ background: "#7c6fd1" }}>
              <FiPlus size={18} color="#fff" />
            </span>
            <span>
              <strong>Tap-to-Run scene</strong>
              <span>One tap fires the actions right away</span>
            </span>
          </button>
          <button
            className="scene-kind-option"
            onClick={() => navigate("/scenes/new?kind=automation")}
            type="button"
          >
            <span className="rule-icon" style={{ background: "var(--ink)" }}>
              <FiPlus size={18} color="#fff" />
            </span>
            <span>
              <strong>Automation</strong>
              <span>Runs by itself when conditions match</span>
            </span>
          </button>
        </div>
      </Sheet>

      {toast ? <div className="jx-toast">{toast}</div> : null}
    </AppShell>
  );
}
