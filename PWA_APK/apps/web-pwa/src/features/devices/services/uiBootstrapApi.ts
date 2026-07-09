import type {
  AuthSession,
  HomeUiBootstrapDeviceBinding,
  HomeUiBootstrapPackageRecord,
  HomeUiBootstrapResponse
} from "@jenix/shared";
import { createUiPackageKey } from "@jenix/shared";

import { createAuthenticatedHeaders } from "../../../app/apiHeaders";
import { getCurrentHome } from "../../dashboard/services/dashboardApi";

const homeEndpoint = "/api/v1/homes";
const demoBootstrapStore = new Map<string, HomeUiBootstrapResponse>();

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { data: T };
  return payload.data;
}

export async function getHomeUiBootstrap(
  session: AuthSession
): Promise<HomeUiBootstrapResponse> {
  const currentHome = getCurrentHome(session);

  try {
    return await fetchJson<HomeUiBootstrapResponse>(
      `${homeEndpoint}/${encodeURIComponent(currentHome.homeId)}/ui-bootstrap`,
      {
        method: "GET",
        headers: createAuthenticatedHeaders(session, {
          homeId: currentHome.homeId
        })
      }
    );
  } catch {
    return (
      demoBootstrapStore.get(currentHome.homeId) ?? {
        homeId: currentHome.homeId,
        generatedAt: new Date().toISOString(),
        devices: [],
        pidBindings: [],
        packages: []
      }
    );
  }
}

export function findUiBindingForDevice(
  bootstrap: HomeUiBootstrapResponse,
  deviceId: string
): HomeUiBootstrapDeviceBinding | undefined {
  return bootstrap.devices.find((device) => device.deviceId === deviceId);
}

export function findUiPackageForDevice(
  bootstrap: HomeUiBootstrapResponse,
  deviceId: string
): HomeUiBootstrapPackageRecord | undefined {
  const binding = findUiBindingForDevice(bootstrap, deviceId);
  if (!binding?.packageKey) {
    return undefined;
  }

  return bootstrap.packages.find(
    (pkg) => createUiPackageKey(pkg.packageId, pkg.version) === binding.packageKey
  );
}

export const uiBootstrapApiTesting = {
  reset() {
    demoBootstrapStore.clear();
  },
  seedBootstrap(homeId: string, bootstrap: HomeUiBootstrapResponse) {
    demoBootstrapStore.set(homeId, structuredClone(bootstrap));
  }
};
