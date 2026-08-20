import { React } from "../host";
import { DEMO_STREAMER_CAMERAS, type StreamerCameraSummary } from "../demoCameras";
import { CameraTestSteps, INITIAL_TEST_STEPS, type TestStep } from "../components/CameraTestSteps";
import { TextField } from "../components/FormFields";

interface CameraFormPageProps {
  cameraId: string | null;
  onBack: () => void;
}

interface CameraFormState {
  friendlyName: string;
  rtspHost: string;
  rtspPort: string;
  rtspPath: string;
  username: string;
  password: string;
  transport: string;
  connectionTimeout: string;
}

function toFormState(camera: StreamerCameraSummary | undefined): CameraFormState {
  return {
    friendlyName: camera?.friendlyName ?? "",
    rtspHost: camera?.rtspHost ?? "",
    rtspPort: camera ? String(camera.rtspPort) : "554",
    rtspPath: camera?.rtspPath ?? "/",
    username: "",
    password: "",
    transport: camera?.transport ?? "tcp",
    connectionTimeout: "5"
  };
}

export function CameraFormPage({ cameraId, onBack }: CameraFormPageProps) {
  const existing = cameraId
    ? DEMO_STREAMER_CAMERAS.find((camera) => camera.cameraId === cameraId)
    : undefined;
  const [form, setForm] = React.useState<CameraFormState>(() => toFormState(existing));
  const [testSteps, setTestSteps] = React.useState<TestStep[]>(INITIAL_TEST_STEPS);
  const [testing, setTesting] = React.useState(false);

  function updateField(field: keyof CameraFormState, value: string): void {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function runTest(): void {
    setTesting(true);
    setTestSteps(INITIAL_TEST_STEPS.map((step) => ({ ...step, status: "in_progress" })));
    // Demo-only simulated pass — replace with polling
    // GET /api/v1/streamer/cameras/:id/test/:testId (VPS/API_CONTRACT.md §2).
    window.setTimeout(() => {
      setTestSteps(INITIAL_TEST_STEPS.map((step) => ({ ...step, status: "passed" })));
      setTesting(false);
    }, 900);
  }

  return (
    <section>
      <button className="text-button" onClick={onBack} style={{ marginBottom: 12 }} type="button">
        ← Back to Cameras
      </button>

      <article className="panel" style={{ marginBottom: 16 }}>
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">{cameraId ? "Edit Camera" : "Add Camera"}</span>
            <h2 style={{ marginBottom: 4 }}>{form.friendlyName || "New Camera"}</h2>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <TextField label="Friendly Name" onChange={(v) => updateField("friendlyName", v)} value={form.friendlyName} />
          <TextField label="RTSP Host" onChange={(v) => updateField("rtspHost", v)} value={form.rtspHost} />
          <TextField label="RTSP Port" onChange={(v) => updateField("rtspPort", v)} value={form.rtspPort} />
          <TextField label="RTSP Path" onChange={(v) => updateField("rtspPath", v)} value={form.rtspPath} />
          <TextField label="Username" onChange={(v) => updateField("username", v)} value={form.username} />
          <TextField
            label="Password"
            onChange={(v) => updateField("password", v)}
            placeholder={cameraId ? "•••••••• (leave blank to keep)" : ""}
            type="password"
            value={form.password}
          />
          <TextField label="RTSP Transport (tcp/udp)" onChange={(v) => updateField("transport", v)} value={form.transport} />
          <TextField
            label="Connection Timeout (s)"
            onChange={(v) => updateField("connectionTimeout", v)}
            value={form.connectionTimeout}
          />
        </div>
        <p className="hint-text" style={{ marginTop: 12 }}>
          Password is write-only — the server never returns it after saving (VPS/API_CONTRACT.md §2).
        </p>
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="text-button" disabled type="button">
            {cameraId ? "Save Changes" : "Create Camera"}
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="scene-section-head">
          <div>
            <span className="eyebrow">Test Camera</span>
            <h2 style={{ marginBottom: 4 }}>Connection Check</h2>
            <p className="hint-text">
              Demo simulation — the real test polls the device via POST .../cameras/:id/test.
            </p>
          </div>
        </div>
        <CameraTestSteps steps={testSteps} />
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button className="text-button" disabled={testing} onClick={runTest} type="button">
            {testing ? "Testing…" : "Run Test"}
          </button>
        </div>
      </article>
    </section>
  );
}
