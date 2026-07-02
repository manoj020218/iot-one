import type { SceneStatus } from "@jenix/shared";
import { StatusPill } from "@jenix/ui";

const toneByStatus: Record<SceneStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  active: "success",
  paused: "warning"
};

export interface SceneStatusBadgeProps {
  status: SceneStatus;
}

export function SceneStatusBadge({ status }: SceneStatusBadgeProps) {
  return <StatusPill label={status.toUpperCase()} tone={toneByStatus[status]} />;
}
