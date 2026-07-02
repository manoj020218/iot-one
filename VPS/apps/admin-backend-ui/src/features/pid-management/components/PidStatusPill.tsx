import type { ProductStatus } from "@jenix/shared";
import { StatusPill } from "@jenix/ui";

const toneByStatus: Record<
  ProductStatus,
  "neutral" | "success" | "warning"
> = {
  draft: "neutral",
  prototype: "warning",
  beta: "warning",
  production: "success",
  discontinued: "neutral"
};

export interface PidStatusPillProps {
  status: ProductStatus;
}

export function PidStatusPill({ status }: PidStatusPillProps) {
  return <StatusPill label={status.toUpperCase()} tone={toneByStatus[status]} />;
}
