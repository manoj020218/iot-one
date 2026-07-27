import { useEffect, useState } from "react";

import type { UiPackageRecord } from "@jenix/shared";

import { listUiPackages } from "../services/uiPackageApi";

export function usePackageRegistry() {
  const [packages, setPackages] = useState<UiPackageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      setPackages(await listUiPackages());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the package registry."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return {
    packages,
    loading,
    error,
    reload: load
  };
}
