import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { FiPlus, FiX } from "react-icons/fi";

import type {
  SceneActionCommand,
  SceneActionType,
  SceneConditionOperator,
  SceneThresholdComparator,
  SceneTriggerType
} from "@jenix/shared";

import type {
  SceneBuilderActionDraft,
  SceneBuilderConditionDraft,
  SceneBuilderDraft,
  SceneBuilderTriggerDraft,
  SceneDeviceOption
} from "../services/sceneBuilder";
import {
  createEmptyActionDraft,
  createEmptyConditionDraft,
  sceneActionCommandOptions,
  sceneComparatorOptions,
  sceneConditionOperatorOptions
} from "../services/sceneBuilder";
import {
  describeActionDraft,
  describeConditionDraft,
  describeTriggerDraft,
  findAutomationTriggerDraft,
  getActionVisual,
  getTriggerVisual
} from "../services/sceneKind";
export interface SceneFlowEditorProps {
  kind: "run" | "automation";
  draft: SceneBuilderDraft;
  deviceOptions: SceneDeviceOption[];
  onChange: (draft: SceneBuilderDraft) => void;
}

const scheduleDays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
] as const;

interface FlowChipProps {
  icon: IconType;
  color: string;
  title: string;
  subtitle: string;
  onRemove?: () => void;
  children?: ReactNode;
}

function FlowChip({ icon: Icon, color, title, subtitle, onRemove, children }: FlowChipProps) {
  return (
    <div className="chip">
      <div className="chip-head">
        <div className="chip-toggle">
          <span className="chip-icon" style={{ background: color }}>
            <Icon size={15} color="#fff" />
          </span>
          <div className="chip-body">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
        </div>
        {onRemove ? (
          <button aria-label={`Remove ${title}`} className="chip-x" onClick={onRemove} type="button">
            <FiX size={15} />
          </button>
        ) : null}
      </div>
      <div className="chip-body-fields">{children}</div>
    </div>
  );
}

export function SceneFlowEditor({ kind, draft, deviceOptions, onChange }: SceneFlowEditorProps) {
  const automationTrigger = findAutomationTriggerDraft(draft.triggers);

  function updateAutomationTrigger(patch: Partial<SceneBuilderTriggerDraft>) {
    onChange({
      ...draft,
      triggers: draft.triggers.map((trigger) =>
        trigger.triggerId === automationTrigger?.triggerId ? { ...trigger, ...patch } : trigger
      )
    });
  }

  function switchTriggerType(type: SceneTriggerType) {
    if (!automationTrigger) {
      return;
    }

    onChange({
      ...draft,
      triggers: draft.triggers.map((trigger) =>
        trigger.triggerId === automationTrigger.triggerId ? { ...trigger, type } : trigger
      ),
      schedule: { ...draft.schedule, enabled: type === "schedule" }
    });
  }

  function toggleScheduleDay(dayValue: number) {
    const hasDay = draft.schedule.daysOfWeek.includes(dayValue);
    onChange({
      ...draft,
      schedule: {
        ...draft.schedule,
        daysOfWeek: hasDay
          ? draft.schedule.daysOfWeek.filter((day) => day !== dayValue)
          : [...draft.schedule.daysOfWeek, dayValue].sort()
      }
    });
  }

  function updateCondition(conditionId: string, patch: Partial<SceneBuilderConditionDraft>) {
    onChange({
      ...draft,
      conditions: draft.conditions.map((condition) =>
        condition.conditionId === conditionId ? { ...condition, ...patch } : condition
      )
    });
  }

  function addCondition() {
    const next = createEmptyConditionDraft();
    onChange({ ...draft, conditions: [...draft.conditions, next] });
  }

  function removeCondition(conditionId: string) {
    onChange({
      ...draft,
      conditions: draft.conditions.filter((condition) => condition.conditionId !== conditionId)
    });
  }

  function updateAction(actionId: string, patch: Partial<SceneBuilderActionDraft>) {
    onChange({
      ...draft,
      actions: draft.actions.map((action) =>
        action.actionId === actionId ? { ...action, ...patch } : action
      )
    });
  }

  function addAction() {
    const next = createEmptyActionDraft();
    onChange({ ...draft, actions: [...draft.actions, next] });
  }

  function removeAction(actionId: string) {
    if (draft.actions.length <= 1) {
      return;
    }
    onChange({ ...draft, actions: draft.actions.filter((action) => action.actionId !== actionId) });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {kind === "automation" && automationTrigger ? (
        <div className="flow-block" data-kind="if">
          <div className="flow-head">
            <div className="flow-label">
              <span className="flow-tag">IF</span>
              <span className="flow-title">Conditions</span>
            </div>
          </div>
          <div className="flow-line">
            <FlowChip
              color={getTriggerVisual(automationTrigger.type).color}
              icon={getTriggerVisual(automationTrigger.type).icon}
              subtitle={describeTriggerDraft(automationTrigger, draft.schedule)}
              title={automationTrigger.type === "schedule" ? "Schedule" : "Device reading"}
            >
              <div className="segmented">
                <button
                  data-active={automationTrigger.type === "device_threshold"}
                  onClick={() => switchTriggerType("device_threshold")}
                  type="button"
                >
                  Device reading
                </button>
                <button
                  data-active={automationTrigger.type === "schedule"}
                  onClick={() => switchTriggerType("schedule")}
                  type="button"
                >
                  Schedule
                </button>
              </div>
              {automationTrigger.type === "device_threshold" ? (
                <>
                  <label className="field">
                    <span>Device</span>
                    <input
                      list="scene-flow-device-options"
                      onChange={(event) => updateAutomationTrigger({ deviceId: event.target.value })}
                      placeholder="JNX-TG-C3-A7F2"
                      value={automationTrigger.deviceId}
                    />
                  </label>
                  <label className="field">
                    <span>Metric key</span>
                    <input
                      onChange={(event) => updateAutomationTrigger({ metricKey: event.target.value })}
                      placeholder="tankLevelPct"
                      value={automationTrigger.metricKey}
                    />
                  </label>
                  <div className="scene-form-grid">
                    <label className="field">
                      <span>Comparator</span>
                      <select
                        onChange={(event) =>
                          updateAutomationTrigger({
                            comparator: event.target.value as SceneThresholdComparator
                          })
                        }
                        value={automationTrigger.comparator}
                      >
                        {sceneComparatorOptions.map((option) => (
                          <option key={option} value={option}>
                            {option.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Threshold</span>
                      <input
                        inputMode="decimal"
                        onChange={(event) => updateAutomationTrigger({ threshold: event.target.value })}
                        placeholder="80"
                        value={automationTrigger.threshold}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="field">
                    <span>Time</span>
                    <input
                      onChange={(event) =>
                        onChange({ ...draft, schedule: { ...draft.schedule, time: event.target.value } })
                      }
                      type="time"
                      value={draft.schedule.time}
                    />
                  </label>
                  <div className="field">
                    <span>Active days</span>
                    <div className="scene-days-grid">
                      {scheduleDays.map((day) => (
                        <label className="checkbox-row" key={day.value}>
                          <input
                            checked={draft.schedule.daysOfWeek.includes(day.value)}
                            onChange={() => toggleScheduleDay(day.value)}
                            type="checkbox"
                          />
                          <span>{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </FlowChip>

            {draft.conditions.map((condition) => (
              <FlowChip
                color="var(--muted)"
                icon={getTriggerVisual("device_threshold").icon}
                key={condition.conditionId}
                onRemove={() => removeCondition(condition.conditionId)}
                subtitle={describeConditionDraft(condition)}
                title="Also require"
              >
                <label className="field">
                  <span>Telemetry field</span>
                  <input
                    onChange={(event) => updateCondition(condition.conditionId, { field: event.target.value })}
                    placeholder="tankLevelPct"
                    value={condition.field}
                  />
                </label>
                <div className="scene-form-grid">
                  <label className="field">
                    <span>Operator</span>
                    <select
                      onChange={(event) =>
                        updateCondition(condition.conditionId, {
                          operator: event.target.value as SceneConditionOperator
                        })
                      }
                      value={condition.operator}
                    >
                      {sceneConditionOperatorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Value</span>
                    <input
                      onChange={(event) => updateCondition(condition.conditionId, { value: event.target.value })}
                      placeholder="80"
                      value={condition.value}
                    />
                  </label>
                </div>
              </FlowChip>
            ))}
          </div>
          <button className="add-chip" onClick={addCondition} type="button">
            <FiPlus size={14} />
            Add condition
          </button>
        </div>
      ) : null}

      <div className="flow-block" data-kind="then">
        <div className="flow-head">
          <div className="flow-label">
            <span className="flow-tag">THEN</span>
            <span className="flow-title">Actions</span>
          </div>
        </div>
        <div className="flow-line">
          {draft.actions.map((action) => (
            <FlowChip
              color={getActionVisual(action.type).color}
              icon={getActionVisual(action.type).icon}
              key={action.actionId}
              {...(draft.actions.length > 1
                ? { onRemove: () => removeAction(action.actionId) }
                : {})}
              subtitle={describeActionDraft(action)}
              title={action.type === "notification" ? "Notify household" : "Device command"}
            >
              <div className="segmented">
                <button
                  data-active={action.type === "notification"}
                  onClick={() => updateAction(action.actionId, { type: "notification" as SceneActionType })}
                  type="button"
                >
                  Notify
                </button>
                <button
                  data-active={action.type === "device_command"}
                  onClick={() => updateAction(action.actionId, { type: "device_command" as SceneActionType })}
                  type="button"
                >
                  Device command
                </button>
              </div>
              {action.type === "notification" ? (
                <label className="field">
                  <span>Message</span>
                  <textarea
                    className="textarea-field"
                    onChange={(event) => updateAction(action.actionId, { message: event.target.value })}
                    placeholder="Tank level crossed 90%. Check the inlet valve."
                    rows={3}
                    value={action.message}
                  />
                </label>
              ) : (
                <>
                  <label className="field">
                    <span>Device</span>
                    <input
                      list="scene-flow-device-options"
                      onChange={(event) => updateAction(action.actionId, { deviceId: event.target.value })}
                      placeholder="JNX-TG-C3-A7F2"
                      value={action.deviceId}
                    />
                  </label>
                  <label className="field">
                    <span>Command</span>
                    <select
                      onChange={(event) =>
                        updateAction(action.actionId, {
                          command: event.target.value as SceneActionCommand
                        })
                      }
                      value={action.command}
                    >
                      {sceneActionCommandOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </FlowChip>
          ))}
        </div>
        <button className="add-chip" onClick={addAction} type="button">
          <FiPlus size={14} />
          Add action
        </button>
      </div>

      <datalist id="scene-flow-device-options">
        {deviceOptions.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </datalist>
    </div>
  );
}
