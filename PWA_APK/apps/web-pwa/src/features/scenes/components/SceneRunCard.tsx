import { useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";

import type { SceneRecord } from "@jenix/shared";

import { getSceneVisual } from "../services/sceneKind";

export interface SceneRunCardProps {
  scene: SceneRecord;
  onRun: (sceneId: string) => Promise<void>;
  onEdit: (sceneId: string) => void;
}

export function SceneRunCard({ scene, onRun, onEdit }: SceneRunCardProps) {
  const [firing, setFiring] = useState(false);
  const visual = getSceneVisual(scene);
  const actionCount = scene.actions.length;

  async function handleRun() {
    if (firing) {
      return;
    }

    setFiring(true);
    try {
      await onRun(scene.sceneId);
    } finally {
      setTimeout(() => setFiring(false), 700);
    }
  }

  return (
    <article className="run-card" data-firing={firing}>
      <button
        aria-label={`Edit ${scene.name}`}
        className="run-card-edit"
        onClick={() => onEdit(scene.sceneId)}
        type="button"
      >
        <FiMoreHorizontal size={16} />
      </button>
      <button className="run-card-surface" onClick={handleRun} type="button">
        <span className="run-card-icon" style={{ background: visual.color }}>
          <visual.icon size={20} color="#fff" />
        </span>
        <div>
          <h3>{scene.name}</h3>
          <span className="run-card-meta">
            {actionCount === 1 ? "1 action" : `${actionCount} actions`}
          </span>
        </div>
      </button>
    </article>
  );
}
