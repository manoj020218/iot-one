import type { SceneRecord } from "@jenix/shared";

import { SceneStatusBadge } from "./SceneStatusBadge";

export interface SceneCardProps {
  scene: SceneRecord;
  onOpen: (sceneId: string) => void;
}

function describeTriggerCount(scene: SceneRecord): string {
  if (scene.triggers.length === 1) {
    return scene.triggers[0]!.type.replace("_", " ");
  }

  return `${scene.triggers.length} triggers`;
}

function describeActionCount(scene: SceneRecord): string {
  if (scene.actions.length === 1) {
    return scene.actions[0]!.type.replace("_", " ");
  }

  return `${scene.actions.length} actions`;
}

function formatLastRun(scene: SceneRecord): string {
  if (!scene.lastRunAt || !scene.lastRunStatus || scene.lastRunStatus === "idle") {
    return "No manual run yet";
  }

  return `${scene.lastRunStatus} at ${new Date(scene.lastRunAt).toLocaleString()}`;
}

export function SceneCard({ scene, onOpen }: SceneCardProps) {
  return (
    <article className="scene-card">
      <div className="scene-card-head">
        <div>
          <p className="scene-card-kicker">{describeTriggerCount(scene)}</p>
          <h3>{scene.name}</h3>
        </div>
        <SceneStatusBadge status={scene.status} />
      </div>
      <dl className="scene-card-meta">
        <div>
          <dt>Actions</dt>
          <dd>{describeActionCount(scene)}</dd>
        </div>
        <div>
          <dt>Conditions</dt>
          <dd>{scene.conditions.length || "Always-on"}</dd>
        </div>
        <div>
          <dt>Last Run</dt>
          <dd>{formatLastRun(scene)}</dd>
        </div>
      </dl>
      <div className="card-actions">
        <button className="primary-button" onClick={() => onOpen(scene.sceneId)} type="button">
          Open Builder
        </button>
      </div>
    </article>
  );
}
