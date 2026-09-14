import { useCallback, useEffect, useState } from "react";

import { getConfig, updateConfig } from "./schoolBellLocalApi";
import type { SchoolBellConfig, SchoolBellConfigPatch } from "./schoolBellTypes";

export interface DeviceConfigState {
  config: SchoolBellConfig | null;
  loading: boolean;
  save: (patch: SchoolBellConfigPatch) => Promise<void>;
}

export function useDeviceConfig(baseUrl: string | null): DeviceConfigState {
  const [config, setConfig] = useState<SchoolBellConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!baseUrl) {
      setConfig(null);
      return;
    }
    setLoading(true);
    getConfig(baseUrl)
      .then(setConfig)
      .finally(() => setLoading(false));
  }, [baseUrl]);

  const save = useCallback(
    async (patch: SchoolBellConfigPatch) => {
      if (!baseUrl) return;
      await updateConfig(baseUrl, patch);
      setConfig((current) => (current ? { ...current, ...patch } : current));
    },
    [baseUrl]
  );

  return { config, loading, save };
}
