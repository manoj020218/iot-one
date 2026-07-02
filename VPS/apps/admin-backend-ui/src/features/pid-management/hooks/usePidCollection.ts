import { useEffect, useState } from "react";

import type { ProductPidRecord } from "@jenix/device-schemas";

import { listPids } from "../services/pidApi";

export function usePidCollection() {
  const [pids, setPids] = useState<ProductPidRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      setPids(await listPids());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load PID records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return {
    pids,
    loading,
    error,
    reload: load
  };
}
