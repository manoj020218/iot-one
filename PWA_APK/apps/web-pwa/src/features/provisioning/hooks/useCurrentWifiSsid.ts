import { useCallback, useEffect, useState } from "react";

import { requestCurrentWifiSsid } from "../services/nativeWifiInfo";

export interface UseCurrentWifiSsidResult {
  ssid: string | null;
  detecting: boolean;
  refresh: () => void;
}

/**
 * Detects the phone's currently-connected Wi-Fi SSID on mount and on
 * demand (see WifiCredentialForm's refresh button) -- lets the
 * provisioning form prefill the network name instead of asking the
 * installer to retype it. Native-only (see nativeWifiInfo.ts); resolves to
 * null on the hosted web PWA or if the user declines location permission,
 * which the form already treats as "fall back to manual entry".
 */
export function useCurrentWifiSsid(): UseCurrentWifiSsidResult {
  const [ssid, setSsid] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    setDetecting(true);

    requestCurrentWifiSsid()
      .then((value) => {
        if (active) setSsid(value);
      })
      .finally(() => {
        if (active) setDetecting(false);
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

  const refresh = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  return { ssid, detecting, refresh };
}
