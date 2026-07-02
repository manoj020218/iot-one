import {
  isRestrictedSceneCommand,
  type SceneActionCommand,
  type SceneActionType
} from "@jenix/shared";

import type { SceneBuilderActionDraft } from "../services/sceneBuilder";
import {
  sceneActionCommandOptions,
  sceneActionTypeOptions
} from "../services/sceneBuilder";
import type { SceneDeviceOption } from "./SceneTriggerEditor";

export interface SceneActionEditorProps {
  actions: SceneBuilderActionDraft[];
  deviceOptions: SceneDeviceOption[];
  onChange: (actions: SceneBuilderActionDraft[]) => void;
}

function formatActionType(type: SceneActionType): string {
  return type.replace("_", " ");
}

function formatCommandLabel(command: SceneActionCommand): string {
  return command.replace("_", " ");
}

export function SceneActionEditor({
  actions,
  deviceOptions,
  onChange
}: SceneActionEditorProps) {
  function updateAction(actionId: string, patch: Partial<SceneBuilderActionDraft>) {
    onChange(
      actions.map((action) =>
        action.actionId === actionId ? { ...action, ...patch } : action
      )
    );
  }

  function addAction() {
    onChange([
      ...actions,
      {
        actionId: `action-${Math.random().toString(36).slice(2, 8)}`,
        type: "notification",
        deviceId: "",
        command: "sync",
        message: "",
        payloadText: ""
      }
    ]);
  }

  function removeAction(actionId: string) {
    onChange(actions.filter((action) => action.actionId !== actionId));
  }

  return (
    <section className="panel scene-section">
      <div className="scene-section-head">
        <div>
          <span className="eyebrow">Actions</span>
          <h2>What should the scene do?</h2>
          <p className="hint-text">
            Notification actions are safest for early rollout. Restricted commands like
            factory reset and forced OTA should stay limited to owner-grade workflows.
          </p>
        </div>
        <button className="secondary-button" onClick={addAction} type="button">
          + Add Action
        </button>
      </div>
      <div className="scene-section-stack">
        {actions.map((action, index) => (
          <article className="scene-array-card" key={action.actionId}>
            <div className="scene-array-head">
              <strong>Action {index + 1}</strong>
              {actions.length > 1 ? (
                <button
                  className="text-button"
                  onClick={() => removeAction(action.actionId)}
                  type="button"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="scene-form-grid">
              <label className="field">
                <span>Action Type</span>
                <select
                  value={action.type}
                  onChange={(event) =>
                    updateAction(action.actionId, {
                      type: event.target.value as SceneActionType
                    })
                  }
                >
                  {sceneActionTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatActionType(option)}
                    </option>
                  ))}
                </select>
              </label>
              {action.type === "device_command" ? (
                <>
                  <label className="field">
                    <span>Target Device</span>
                    <input
                      list="scene-action-device-options"
                      placeholder="JNX-TG-C3-A7F2"
                      value={action.deviceId}
                      onChange={(event) =>
                        updateAction(action.actionId, {
                          deviceId: event.target.value
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Command</span>
                    <select
                      value={action.command}
                      onChange={(event) =>
                        updateAction(action.actionId, {
                          command: event.target.value as SceneActionCommand
                        })
                      }
                    >
                      {sceneActionCommandOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatCommandLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field scene-field-span">
                    <span>Payload JSON (optional)</span>
                    <textarea
                      className="textarea-field"
                      placeholder={'{\n  "relay": true\n}'}
                      rows={5}
                      value={action.payloadText}
                      onChange={(event) =>
                        updateAction(action.actionId, {
                          payloadText: event.target.value
                        })
                      }
                    />
                  </label>
                  {isRestrictedSceneCommand(action.command) ? (
                    <p className="inline-error">
                      This command is restricted and should only be used by owner/admin
                      roles.
                    </p>
                  ) : null}
                </>
              ) : null}
              {action.type === "notification" ? (
                <label className="field scene-field-span">
                  <span>Message</span>
                  <textarea
                    className="textarea-field"
                    placeholder="Tank level crossed 80%. Notify the operator."
                    rows={4}
                    value={action.message}
                    onChange={(event) =>
                      updateAction(action.actionId, {
                        message: event.target.value
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      <datalist id="scene-action-device-options">
        {deviceOptions.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </datalist>
    </section>
  );
}
