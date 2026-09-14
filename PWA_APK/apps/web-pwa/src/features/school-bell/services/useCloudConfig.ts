import { useCallback, useEffect, useState } from "react";

import { getCloudConfig, updateCloudConfig } from "./schoolBellLocalApi";
import type { CloudConfig, CloudConfigPatch } from "./schoolBellTypes";

export interface CloudConfigState {
  config: CloudConfig | null;
  loading: boolean;
  reload: () => void;
  save: (patch: CloudConfigPatch) => Promise<void>;
}

/**
 * The device's own MQTT bridge (status/LWT + OTA, see
 * FIRMWARE_TASKS_APK_INTEGRATION.md and API_V1.md's "Jenix One MQTT/OTA
 * contract") — distinct from useSchoolBellConnection's cloudEnabled,
 * which is this app's own (not-yet-implemented) relay-control toggle.
 * This one is real today: enabling it lets the platform see the device
 * online and push firmware updates.
 */
export function useCloudConfig(baseUrl: string | null): CloudConfigState {
  const [config, setConfig] = useState<CloudConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!baseUrl) {
      setConfig(null);
      return;
    }
    setLoading(true);
    getCloudConfig(baseUrl)
      .then(setConfig)
      .finally(() => setLoading(false));
  }, [baseUrl, attempt]);

  const save = useCallback(
    async (patch: CloudConfigPatch) => {
      if (!baseUrl) return;
      await updateCloudConfig(baseUrl, patch);
      setConfig((current) => (current ? { ...current, ...patch } : current));
    },
    [baseUrl]
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { config, loading, reload, save };
}
