import type { SceneConditionOperator } from "@jenix/shared";

import type { SceneBuilderConditionDraft } from "../services/sceneBuilder";
import { sceneConditionOperatorOptions } from "../services/sceneBuilder";

export interface SceneConditionEditorProps {
  conditions: SceneBuilderConditionDraft[];
  onChange: (conditions: SceneBuilderConditionDraft[]) => void;
}

function formatOperatorLabel(operator: SceneConditionOperator): string {
  return operator.toUpperCase();
}

export function SceneConditionEditor({
  conditions,
  onChange
}: SceneConditionEditorProps) {
  function updateCondition(
    conditionId: string,
    patch: Partial<SceneBuilderConditionDraft>
  ) {
    onChange(
      conditions.map((condition) =>
        condition.conditionId === conditionId
          ? {
              ...condition,
              ...patch
            }
          : condition
      )
    );
  }

  function addCondition() {
    onChange([
      ...conditions,
      {
        conditionId: `condition-${Math.random().toString(36).slice(2, 8)}`,
        field: "",
        operator: "gte",
        value: ""
      }
    ]);
  }

  function removeCondition(conditionId: string) {
    onChange(conditions.filter((condition) => condition.conditionId !== conditionId));
  }

  return (
    <section className="panel scene-section">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Conditions</span>
          <h2>What must be true before actions run?</h2>
          <p className="hint-text">
            Leave conditions empty for always-on scenes. Use numbers like 80 and booleans
            like true or false directly in the value field.
          </p>
        </div>
        <button className="secondary-button" onClick={addCondition} type="button">
          + Add Condition
        </button>
      </div>
      {conditions.length === 0 ? (
        <p className="provisioning-note">
          No conditions added. This scene will run whenever its trigger fires.
        </p>
      ) : null}
      <div className="scene-section-stack">
        {conditions.map((condition, index) => (
          <article className="scene-array-card" key={condition.conditionId}>
            <div className="scene-array-head">
              <strong>Condition {index + 1}</strong>
              <button
                className="text-button"
                onClick={() => removeCondition(condition.conditionId)}
                type="button"
              >
                Remove
              </button>
            </div>
            <div className="scene-form-grid">
              <label className="field">
                <span>Telemetry Field</span>
                <input
                  placeholder="tankLevelPct"
                  value={condition.field}
                  onChange={(event) =>
                    updateCondition(condition.conditionId, {
                      field: event.target.value
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Operator</span>
                <select
                  value={condition.operator}
                  onChange={(event) =>
                    updateCondition(condition.conditionId, {
                      operator: event.target.value as SceneConditionOperator
                    })
                  }
                >
                  {sceneConditionOperatorOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatOperatorLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Value</span>
                <input
                  placeholder="80"
                  value={condition.value}
                  onChange={(event) =>
                    updateCondition(condition.conditionId, {
                      value: event.target.value
                    })
                  }
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
