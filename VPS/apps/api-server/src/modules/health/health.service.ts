import { platformIdentity } from "@jenix/shared";

export function getHealthSnapshot() {
  return {
    service: "api-server",
    project: platformIdentity.projectName,
    apiPrefix: platformIdentity.apiPrefix,
    status: "ok" as const
  };
}
