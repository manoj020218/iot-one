import type { HomeUiBootstrapPackageRecord } from "@jenix/shared";

import { createUiPackageKey } from "@jenix/shared";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const packageCatalog = new Map<string, HomeUiBootstrapPackageRecord>([
  [
    createUiPackageKey("tank-guard-mobile", "1.0.0"),
    {
      packageId: "tank-guard-mobile",
      version: "1.0.0",
      manifestPath: "/ui-packages/tank-guard-mobile/1.0.0/manifest.json",
      entryPath: "/ui-packages/tank-guard-mobile/1.0.0/remoteEntry.js",
      exportName: "TankGuardDynamicPage"
    }
  ]
]);

export function resolveUiPackageArtifact(
  packageId: string,
  version: string
): HomeUiBootstrapPackageRecord | undefined {
  return clone(packageCatalog.get(createUiPackageKey(packageId, version)));
}
