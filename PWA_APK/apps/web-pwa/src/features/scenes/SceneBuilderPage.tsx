import type { SceneActionDispatchRecord, SceneTelemetrySnapshot } from "@jenix/shared";
import { AppShell, StatusPill } from "@jenix/ui";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import {
  getCurrentHome,
  getDashboardDevices,
  type DashboardDevice
} from "../dashboard/services/dashboardApi";
import { SceneActionEditor } from "./components/SceneActionEditor";
import { SceneConditionEditor } from "./components/SceneConditionEditor";
import { SceneDispatchHistoryPanel } from "./components/SceneDispatchHistoryPanel";
import { SceneScheduleEditor } from "./components/SceneScheduleEditor";
import { SceneStatusBadge } from "./components/SceneStatusBadge";
import {
  type SceneDeviceOption,
  SceneTriggerEditor
} from "./components/SceneTriggerEditor";
import {
  createScene,
  getScene,
  listSceneDispatches,
  replaySceneDispatch,
  runSceneManually,
  updateScene
} from "./services/sceneApi";
import {
  createInitialSceneDraft,
  draftToCreateInput,
  draftToUpdateInput,
  sceneRecordToDraft,
  validateSceneDraft,
  type SceneBuilderDraft
} from "./services/sceneBuilder";

function buildDeviceOptions(devices: DashboardDevice[]): SceneDeviceOption[] {
  return devices.map((device) => ({
    deviceId: device.deviceId,
    label: `${device.displayName} (${device.deviceId})`
  }));
}

function parseTelemetryInput(rawValue: string): SceneTelemetrySnapshot | undefined {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Telemetry JSON must be an object.");
  }

  const telemetry: SceneTelemetrySnapshot = {};

  for (const [key, value] of Object.entries(parsed)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      telemetry[key] = value;
      continue;
    }

    throw new Error(`Telemetry field "${key}" must be string, number, or boolean.`);
  }

  return telemetry;
}

function optionalTelemetry(
  telemetry: SceneTelemetrySnapshot | undefined
): { telemetry?: SceneTelemetrySnapshot } {
  if (!telemetry) {
    return {};
  }

  return { telemetry };
}

export function SceneBuilderPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { sceneId } = useParams<{ sceneId: string }>();
  const isCreateMode = !sceneId;
  const [draft, setDraft] = useState<SceneBuilderDraft>(() => createInitialSceneDraft());
  const [deviceOptions, setDeviceOptions] = useState<SceneDeviceOption[]>([]);
  const [dispatches, setDispatches] = useState<SceneActionDispatchRecord[]>([]);
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [telemetryText, setTelemetryText] = useState('{\n  "tankLevelPct": 90\n}');
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);

  if (!session) {
    throw new Error("SceneBuilderPage requires an authenticated session");
  }

  const authSession = session;
  const currentHome = getCurrentHome(authSession);
  const hasScheduleTrigger = draft.triggers.some((trigger) => trigger.type === "schedule");

  async function refreshSceneDispatchState(targetSceneId: string) {
    setDispatches(await listSceneDispatches(authSession, targetSceneId));
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(!isCreateMode);
      setError(null);

      try {
        const [devices, scene, sceneDispatches] = await Promise.all([
          getDashboardDevices(authSession),
          sceneId ? getScene(authSession, sceneId) : Promise.resolve(null),
          sceneId ? listSceneDispatches(authSession, sceneId) : Promise.resolve([])
        ]);

        if (cancelled) {
          return;
        }

        setDeviceOptions(buildDeviceOptions(devices));
        setDispatches(sceneDispatches);
        if (scene) {
          setDraft(sceneRecordToDraft(scene));
        } else {
          setDraft(createInitialSceneDraft());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the scene builder."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authSession, isCreateMode, sceneId]);

  async function handleSave() {
    const errors = validateSceneDraft(draft);
    setValidationErrors(errors);
    setSaveMessage(null);
    setRunMessage(null);
    setRunError(null);

    if (errors.length > 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isCreateMode) {
        const createdScene = await createScene(authSession, draftToCreateInput(draft));
        navigate(`/scenes/${createdScene.sceneId}`);
        return;
      }

      const savedScene = await updateScene(
        authSession,
        sceneId,
        draftToUpdateInput(draft)
      );
      setDraft(sceneRecordToDraft(savedScene));
      setSaveMessage("Scene saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save the scene."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleManualRun() {
    if (!sceneId) {
      return;
    }

    setRunBusy(true);
    setRunMessage(null);
    setRunError(null);

    try {
      const telemetry = parseTelemetryInput(telemetryText);
      const result = await runSceneManually(
        authSession,
        sceneId,
        optionalTelemetry(telemetry)
      );
      setDraft(sceneRecordToDraft(result.scene));
      await refreshSceneDispatchState(sceneId);
      setRunMessage(
        result.matchedConditions
          ? `Manual run executed ${result.executedActions.length} action(s).`
          : "Manual run completed but conditions did not match."
      );
    } catch (manualRunError) {
      setRunError(
        manualRunError instanceof Error
          ? manualRunError.message
          : "Manual run failed."
      );
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <AppShell
      eyebrow="Scene Builder"
      title={isCreateMode ? "Create an automation scene" : `Edit ${draft.name || "scene"}`}
      description="Build threshold alerts, scheduled automations, and safe manual test flows from one operator-facing editor."
      aside={<SceneStatusBadge status={draft.status} />}
    >
      <section className="top-bar">
        <div>
          <span className="eyebrow">Active HOME</span>
          <h2>{currentHome.name}</h2>
          <p>Signed in as {session.user.name}</p>
        </div>
        <div className="top-bar-meta">
          <StatusPill
            label={`${deviceOptions.length} devices`}
            tone={deviceOptions.length > 0 ? "success" : "warning"}
          />
          <button
            className="text-button"
            onClick={() => navigate("/scenes")}
            type="button"
          >
            Back to Scenes
          </button>
        </div>
      </section>
      {loading ? <section className="panel">Loading scene builder...</section> : null}
      {error ? <section className="panel">{error}</section> : null}
      {!loading ? (
        <div className="content-grid">
          <section className="form-card">
            <span className="eyebrow">Identity</span>
            <h2>Scene metadata</h2>
            <label className="field">
              <span>Scene Name</span>
              <input
                placeholder="High Tank Alert"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as SceneBuilderDraft["status"]
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </label>
            <p className="hint-text">
              Draft scenes are safe for builder work. Active scenes are ready for real
              triggers. Paused scenes stay stored but manual runs are blocked by the API.
            </p>
          </section>
          <section className="panel">
            <span className="eyebrow">Builder Notes</span>
            <h2>Operator guidance</h2>
            <ul className="instruction-list">
              <li>Use manual triggers first to validate the action chain.</li>
              <li>Use threshold triggers only after metric keys are stable.</li>
              <li>
                Prefer notifications during rollout, then graduate to device commands when
                recovery paths are verified.
              </li>
            </ul>
            {deviceOptions.length === 0 ? (
              <p className="provisioning-note">
                No registered devices were found for this HOME yet. You can still enter
                device IDs manually, but provisioning a device first will make the builder
                safer.
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
      {!loading && validationErrors.length > 0 ? (
        <section className="panel">
          <h2>Resolve these items before saving</h2>
          <ul className="instruction-list">
            {validationErrors.map((validationError) => (
              <li key={validationError}>{validationError}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {!loading ? (
        <>
          <SceneTriggerEditor
            deviceOptions={deviceOptions}
            triggers={draft.triggers}
            onChange={(triggers) =>
              setDraft((current) => ({
                ...current,
                triggers
              }))
            }
          />
          <SceneConditionEditor
            conditions={draft.conditions}
            onChange={(conditions) =>
              setDraft((current) => ({
                ...current,
                conditions
              }))
            }
          />
          <SceneActionEditor
            actions={draft.actions}
            deviceOptions={deviceOptions}
            onChange={(actions) =>
              setDraft((current) => ({
                ...current,
                actions
              }))
            }
          />
          <SceneScheduleEditor
            hasScheduleTrigger={hasScheduleTrigger}
            schedule={draft.schedule}
            onChange={(schedule) =>
              setDraft((current) => ({
                ...current,
                schedule
              }))
            }
          />
          <section className="panel scene-section">
            <div className="scene-section-head">
              <div>
                <span className="eyebrow">Save</span>
                <h2>Commit the current builder state</h2>
              </div>
              <button
                className="primary-button"
                disabled={saving}
                onClick={handleSave}
                type="button"
              >
                {saving ? "Saving..." : isCreateMode ? "Create Scene" : "Save Changes"}
              </button>
            </div>
            {saveMessage ? <p className="provisioning-note">{saveMessage}</p> : null}
          </section>
          {!isCreateMode ? (
            <section className="panel scene-section">
              <div className="scene-section-head">
                <div>
                  <span className="eyebrow">Manual Test Run</span>
                  <h2>Run the scene against sample telemetry</h2>
                  <p className="hint-text">
                    This uses the backend manual-run route when available and the local
                    evaluator otherwise.
                  </p>
                </div>
                <button
                  className="secondary-button"
                  disabled={runBusy}
                  onClick={handleManualRun}
                  type="button"
                >
                  {runBusy ? "Running..." : "Run Manual Test"}
                </button>
              </div>
              <label className="field">
                <span>Telemetry JSON</span>
                <textarea
                  className="textarea-field"
                  rows={7}
                  value={telemetryText}
                  onChange={(event) => setTelemetryText(event.target.value)}
                />
              </label>
              {runMessage ? <p className="provisioning-note">{runMessage}</p> : null}
              {runError ? <p className="inline-error">{runError}</p> : null}
            </section>
          ) : null}
          {!isCreateMode ? (
            <SceneDispatchHistoryPanel
              dispatches={dispatches}
              canReplay={currentHome.role !== "viewer"}
              onReplay={async (jobId) => {
                const replayed = await replaySceneDispatch(authSession, sceneId, jobId);
                await refreshSceneDispatchState(sceneId);
                return replayed;
              }}
              onRefresh={() => refreshSceneDispatchState(sceneId)}
            />
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
