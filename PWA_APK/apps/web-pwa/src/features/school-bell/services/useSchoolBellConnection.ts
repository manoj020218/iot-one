import { useCallback, useEffect, useState } from "react";

import {
  getLocalDeviceAddress,
  isCloudControlEnabled,
  setCloudControlEnabled,
  setLocalDeviceAddress
} from "./localDeviceAddress";
import { probeLocalDevice } from "./schoolBellLocalHttp";
import { isCloudRelayAvailable } from "./schoolBellCloudApi";

export type ConnectionMode = "checking" | "local" | "cloud-pending" | "offline";

export interface SchoolBellConnection {
  mode: ConnectionMode;
  /** Only set when mode === "local" — every screen should gate writes on this, not just on cloudEnabled. */
  baseUrl: string | null;
  localAddress: string | null;
  saveLocalAddress: (address: string) => void;
  cloudEnabled: boolean;
  setCloudEnabled: (enabled: boolean) => void;
  retry: () => void;
}

/**
 * Decides, for one device, whether the plugin should talk to it directly
 * over the local network or fall back to a (currently unavailable) cloud
 * relay — the hybrid model from the approved design: local-first always,
 * cloud strictly opt-in and off by default. Every screen reads `mode`
 * and `baseUrl` from here rather than deciding connectivity itself.
 */
export function useSchoolBellConnection(deviceId: string): SchoolBellConnection {
  const [localAddress, setLocalAddressState] = useState<string | null>(() => getLocalDeviceAddress(deviceId));
  const [cloudEnabled, setCloudEnabledState] = useState<boolean>(() => isCloudControlEnabled(deviceId));
  const [mode, setMode] = useState<ConnectionMode>("checking");
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setMode("checking");

    async function resolve() {
      if (localAddress) {
        const reachable = await probeLocalDevice(localAddress);
        if (!active) return;
        if (reachable) {
          setBaseUrl(localAddress);
          setMode("local");
          return;
        }
      }

      setBaseUrl(null);
      if (cloudEnabled) {
        const cloudReady = await isCloudRelayAvailable();
        if (!active) return;
        setMode(cloudReady ? "cloud-pending" : "cloud-pending");
        return;
      }

      if (active) setMode("offline");
    }

    void resolve();
    return () => {
      active = false;
    };
  }, [deviceId, localAddress, cloudEnabled, attempt]);

  const saveLocalAddress = useCallback(
    (address: string) => {
      setLocalDeviceAddress(deviceId, address);
      setLocalAddressState(getLocalDeviceAddress(deviceId));
    },
    [deviceId]
  );

  const setCloudEnabled = useCallback(
    (enabled: boolean) => {
      setCloudControlEnabled(deviceId, enabled);
      setCloudEnabledState(enabled);
    },
    [deviceId]
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { mode, baseUrl, localAddress, saveLocalAddress, cloudEnabled, setCloudEnabled, retry };
}
