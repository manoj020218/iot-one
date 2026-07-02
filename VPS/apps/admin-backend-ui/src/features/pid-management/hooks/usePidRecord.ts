import { useEffect, useState } from "react";

import type { ProductPidRecord } from "@jenix/device-schemas";

import { getPid } from "../services/pidApi";

export function usePidRecord(pid: string | undefined) {
  const [record, setRecord] = useState<ProductPidRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!pid) {
      setRecord(null);
      setLoading(false);
      setError("PID parameter is missing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setRecord(await getPid(pid));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load PID."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [pid]);

  return {
    record,
    loading,
    error,
    reload: load
  };
}
