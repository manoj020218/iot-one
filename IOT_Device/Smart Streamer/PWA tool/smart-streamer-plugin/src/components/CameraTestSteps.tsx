import { React } from "../host";

export type TestStepStatus = "pending" | "in_progress" | "passed" | "failed";

export interface TestStep {
  id: string;
  label: string;
  status: TestStepStatus;
}

// Order and labels match Streamer Plugin.txt §8's 6-step checklist and
// the test response shape in VPS/API_CONTRACT.md §2.
export const INITIAL_TEST_STEPS: TestStep[] = [
  { id: "reachable", label: "Camera reachable", status: "pending" },
  { id: "rtsp_auth", label: "RTSP authentication successful", status: "pending" },
  { id: "video_codec", label: "H.264 video detected", status: "pending" },
  { id: "audio_codec", label: "AAC audio detected", status: "pending" },
  { id: "keyframe", label: "Keyframe received", status: "pending" },
  { id: "passthrough_compatible", label: "Compatible with passthrough mode", status: "pending" }
];

function statusMark(status: TestStepStatus): string {
  if (status === "passed") return "✓";
  if (status === "failed") return "✗";
  if (status === "in_progress") return "…";
  return "○";
}

export function CameraTestSteps({ steps }: { steps: TestStep[] }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
      {steps.map((step) => (
        <li key={step.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span aria-hidden style={{ width: 18, textAlign: "center", opacity: step.status === "pending" ? 0.4 : 1 }}>
            {statusMark(step.status)}
          </span>
          <span className="hint-text">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
