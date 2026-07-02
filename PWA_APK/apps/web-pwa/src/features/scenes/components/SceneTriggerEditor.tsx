import type { SceneThresholdComparator, SceneTriggerType } from "@jenix/shared";

import type { SceneBuilderTriggerDraft } from "../services/sceneBuilder";
import {
  sceneComparatorOptions,
  sceneTriggerTypeOptions
} from "../services/sceneBuilder";

export interface SceneDeviceOption {
  deviceId: string;
  label: string;
}

export interface SceneTriggerEditorProps {
  triggers: SceneBuilderTriggerDraft[];
  deviceOptions: SceneDeviceOption[];
  onChange: (triggers: SceneBuilderTriggerDraft[]) => void;
}

function formatTriggerLabel(type: SceneTriggerType): string {
  return type.replace("_", " ");
}

function formatComparatorLabel(value: SceneThresholdComparator): string {
  return value.toUpperCase();
}

export function SceneTriggerEditor({
  triggers,
  deviceOptions,
  onChange
}: SceneTriggerEditorProps) {
  function updateTrigger(
    triggerId: string,
    patch: Partial<SceneBuilderTriggerDraft>
  ) {
    onChange(
      triggers.map((trigger) =>
        trigger.triggerId === triggerId ? { ...trigger, ...patch } : trigger
      )
    );
  }

  function addTrigger() {
    onChange([
      ...triggers,
      {
        triggerId: `trigger-${Math.random().toString(36).slice(2, 8)}`,
        type: "manual",
        deviceId: "",
        metricKey: "",
        comparator: "gte",
        threshold: ""
      }
    ]);
  }

  function removeTrigger(triggerId: string) {
    onChange(triggers.filter((trigger) => trigger.triggerId !== triggerId));
  }

  return (
    <section className="panel scene-section">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Triggers</span>
          <h2>How should this scene start?</h2>
          <p className="hint-text">
            Use manual runs for operator testing, threshold triggers for device telemetry,
            and schedule triggers for time-based automation.
          </p>
        </div>
        <button className="secondary-button" onClick={addTrigger} type="button">
          + Add Trigger
        </button>
      </div>
      <div className="scene-section-stack">
        {triggers.map((trigger, index) => (
          <article className="scene-array-card" key={trigger.triggerId}>
            <div className="scene-array-head">
              <strong>Trigger {index + 1}</strong>
              {triggers.length > 1 ? (
                <button
                  className="text-button"
                  onClick={() => removeTrigger(trigger.triggerId)}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="scene-form-grid">
              <label className="field">
                <span>Trigger Type</span>
                <select
                  value={trigger.type}
                  onChange={(event) =>
                    updateTrigger(trigger.triggerId, {
                      type: event.target.value as SceneTriggerType
                    })
                  }
                >
                  {sceneTriggerTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatTriggerLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              {trigger.type === "device_threshold" ? (
                <>
                  <label className="field">
                    <span>Device ID</span>
                    <input
                      list="scene-trigger-device-options"
                      placeholder="JNX-TG-C3-A7F2"
                      value={trigger.deviceId}
                      onChange={(event) =>
                        updateTrigger(trigger.triggerId, {
                          deviceId: event.target.value
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Metric Key</span>
                    <input
                      placeholder="tankLevelPct"
                      value={trigger.metricKey}
                      onChange={(event) =>
                        updateTrigger(trigger.triggerId, {
                          metricKey: event.target.value
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Comparator</span>
                    <select
                      value={trigger.comparator}
                      onChange={(event) =>
                        updateTrigger(trigger.triggerId, {
                          comparator: event.target.value as SceneThresholdComparator
                        })
                      }
                    >
                      {sceneComparatorOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatComparatorLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Threshold</span>
                    <input
                      inputMode="decimal"
                      placeholder="80"
                      value={trigger.threshold}
                      onChange={(event) =>
                        updateTrigger(trigger.triggerId, {
                          threshold: event.target.value
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
              {trigger.type === "schedule" ? (
                <p className="provisioning-note">
                  Schedule triggers use the schedule section below for timezone, day, and
                  time controls.
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <datalist id="scene-trigger-device-options">
        {deviceOptions.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </datalist>
    </section>
  );
}
