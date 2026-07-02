import type { AuthSession, SceneRecord } from "@jenix/shared";
import { useEffect, useState } from "react";

import { listScenes } from "../services/sceneApi";

export function useScenes(session: AuthSession) {
  const [scenes, setScenes] = useState<SceneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);

    try {
      setScenes(await listScenes(session));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load scenes."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [session.user.userId, session.activeHomeId]);

  return {
    scenes,
    loading,
    error,
    reload
  };
}
