import type { SceneActionDispatchRecord, SceneStatus, SceneTelemetrySnapshot } from "@jenix/shared";
import { AppShell } from "@jenix/ui";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import {
  getCurrentHome,
  getDashboardDevices,
  type DashboardDevice
} from "../dashboard/services/dashboardApi";
import { SceneDispatchHistoryPanel } from "./components/SceneDispatchHistoryPanel";
import { SceneFlowEditor } from "./components/SceneFlowEditor";
import {
  createInitialSceneDraft,
  draftToCreateInput,
  draftToUpdateInput,
  sceneRecordToDraft,
  validateSceneDraft,
  type SceneBuilderDraft,
  type SceneDeviceOption
} from "./services/sceneBuilder";
import {
  createScene,
  deleteScene,
  getScene,
  listSceneDispatches,
  replaySceneDispatch,
  runSceneManually,
  updateScene
} from "./services/sceneApi";
import { classifySceneDraft, getSceneDraftVisual, type SceneKind } from "./services/sceneKind";

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

const kindLabel: Record<SceneKind, string> = {
  run: "Tap-to-Run scene",
  automation: "Automation"
};

export function SceneBuilderPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { sceneId } = useParams<{ sceneId: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !sceneId;
  const requestedKind: SceneKind = searchParams.get("kind") === "automation" ? "automation" : "run";
  const [draft, setDraft] = useState<SceneBuilderDraft>(() =>
    createInitialSceneDraft(requestedKind)
  );
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!session) {
    throw new Error("SceneBuilderPage requires an authenticated session");
  }

  const authSession = session;
  const currentHome = getCurrentHome(authSession);
  const kind = isCreateMode ? requestedKind : classifySceneDraft(draft);
  const visual = getSceneDraftVisual(draft);
  const isActive = draft.status === "active";

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
          setDraft(createInitialSceneDraft(requestedKind));
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
  }, [authSession, isCreateMode, sceneId, requestedKind]);

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
      setSaveMessage("Saved.");
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
          ? `Ran ${result.executedActions.length} action(s).`
          : "Run completed but conditions did not match."
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

  async function handleDelete() {
    if (!sceneId) {
      return;
    }

    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteScene(authSession, sceneId);
      navigate("/scenes");
    } catch (deleteErrorValue) {
      setDeleteError(
        deleteErrorValue instanceof Error
          ? deleteErrorValue.message
          : "Unable to delete this scene."
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell
      eyebrow={kindLabel[kind]}
      title={isCreateMode ? `New ${kindLabel[kind].toLowerCase()}` : draft.name || "Scene"}
    >
      <button className="editor-back" onClick={() => navigate("/scenes")} type="button">
        <FiArrowLeft size={16} />
        Scenes
      </button>

      {loading ? <section className="panel">Loading scene builder...</section> : null}
      {error ? <section className="panel">{error}</section> : null}

      {!loading ? (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="editor-hero">
            <span className="rule-icon" style={{ background: visual.color }}>
              <visual.icon size={22} color="#fff" />
            </span>
            <input
              aria-label="Scene Name"
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder={kind === "run" ? "Fill Alert Test" : "High Tank Alert"}
              value={draft.name}
            />
          </div>

          {kind === "automation" ? (
            <div className="editor-status-row">
              <span>{isActive ? "Active" : "Paused"}</span>
              <button
                aria-label={isActive ? "Pause automation" : "Activate automation"}
                className="switch"
                data-on={isActive}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    status: (current.status === "active" ? "paused" : "active") as SceneStatus
                  }))
                }
                type="button"
              />
            </div>
          ) : null}

          {validationErrors.length > 0 ? (
            <section className="panel">
              <h2>Resolve these before saving</h2>
              <ul className="instruction-list">
                {validationErrors.map((validationError) => (
                  <li key={validationError}>{validationError}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <SceneFlowEditor
            deviceOptions={deviceOptions}
            draft={draft}
            kind={kind}
            onChange={setDraft}
          />

          {deviceOptions.length === 0 ? (
            <p className="hint-text">
              No registered devices were found for this home yet. You can still type a
              device ID manually.
            </p>
          ) : null}

          <section className="panel scene-section">
            <div className="scene-section-head">
              <div>
                <span className="eyebrow">Save</span>
                <h2>{isCreateMode ? `Create the ${kind === "run" ? "scene" : "automation"}` : "Save changes"}</h2>
              </div>
              <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
                {saving ? "Saving..." : isCreateMode ? "Create" : "Save Changes"}
              </button>
            </div>
            {saveMessage ? <p className="provisioning-note">{saveMessage}</p> : null}
          </section>

          {!isCreateMode ? (
            <section className="panel scene-section">
              <div className="scene-section-head">
                <div>
                  <span className="eyebrow">Danger zone</span>
                  <h2>Delete this {kind === "run" ? "scene" : "automation"}</h2>
                  <p className="hint-text">This can't be undone.</p>
                </div>
                <button className="danger-button" disabled={deleting} onClick={handleDelete} type="button">
                  {deleting
                    ? "Deleting..."
                    : confirmDelete
                      ? "Tap again to delete"
                      : `Delete ${kind === "run" ? "scene" : "automation"}`}
                </button>
              </div>
              {deleteError ? <p className="inline-error">{deleteError}</p> : null}
            </section>
          ) : null}

          {!isCreateMode ? (
            <section className="panel scene-section">
              <div className="scene-section-head">
                <div>
                  <span className="eyebrow">Test</span>
                  <h2>{kind === "run" ? "Run this scene now" : "Run against sample telemetry"}</h2>
                  {draft.conditions.length > 0 ? (
                    <p className="hint-text">
                      Uses the telemetry below to check the extra conditions on this
                      automation.
                    </p>
                  ) : null}
                </div>
                <button className="secondary-button" disabled={runBusy} onClick={handleManualRun} type="button">
                  {runBusy ? "Running..." : "Run Now"}
                </button>
              </div>
              {draft.conditions.length > 0 ? (
                <label className="field">
                  <span>Telemetry JSON</span>
                  <textarea
                    className="textarea-field"
                    onChange={(event) => setTelemetryText(event.target.value)}
                    rows={5}
                    value={telemetryText}
                  />
                </label>
              ) : null}
              {runMessage ? <p className="provisioning-note">{runMessage}</p> : null}
              {runError ? <p className="inline-error">{runError}</p> : null}
            </section>
          ) : null}

          {!isCreateMode ? (
            <SceneDispatchHistoryPanel
              canReplay={currentHome.role !== "viewer"}
              dispatches={dispatches}
              onReplay={async (jobId) => {
                const replayed = await replaySceneDispatch(authSession, sceneId, jobId);
                await refreshSceneDispatchState(sceneId);
                return replayed;
              }}
              onRefresh={() => refreshSceneDispatchState(sceneId)}
            />
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
