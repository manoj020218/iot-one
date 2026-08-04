import { useState } from "react";
import { FiChevronRight } from "react-icons/fi";

import type { SceneRecord } from "@jenix/shared";

import { getSceneVisual, ifSummaryForScene, thenSummaryForScene } from "../services/sceneKind";

export interface SceneRuleRowProps {
  scene: SceneRecord;
  onToggle: (sceneId: string, active: boolean) => Promise<void>;
  onOpen: (sceneId: string) => void;
}

export function SceneRuleRow({ scene, onToggle, onOpen }: SceneRuleRowProps) {
  const [toggling, setToggling] = useState(false);
  const visual = getSceneVisual(scene);
  const active = scene.status === "active";

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(scene.sceneId, !active);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="rule-row" data-active={active}>
      <button
        className="rule-row-surface"
        onClick={() => onOpen(scene.sceneId)}
        type="button"
      >
        <span className="rule-icon" style={{ background: visual.color }}>
          <visual.icon size={18} color="#fff" />
        </span>
        <div className="rule-body">
          <h3>{scene.name}</h3>
          <p className="rule-flow">
            <strong>IF</strong> {ifSummaryForScene(scene)} <strong>&rarr; THEN</strong>{" "}
            {thenSummaryForScene(scene)}
          </p>
        </div>
      </button>
      <button
        aria-label={active ? `Pause ${scene.name}` : `Activate ${scene.name}`}
        className="switch"
        data-on={active}
        disabled={toggling}
        onClick={handleToggle}
        type="button"
      />
      <FiChevronRight className="rule-chev" size={16} />
    </div>
  );
}
