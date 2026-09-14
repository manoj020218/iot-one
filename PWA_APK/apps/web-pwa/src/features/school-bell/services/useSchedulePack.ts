import { useCallback, useEffect, useState } from "react";

import { getSchedulePack, replaceSchedulePack } from "./schoolBellLocalApi";
import type { SchedulePack } from "./schoolBellTypes";

export interface SchedulePackState {
  pack: SchedulePack | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Firmware requires the complete pack on every write (see API_V1.md's "send complete arrays" rule) — never a partial patch. */
  save: (next: SchedulePack) => Promise<void>;
}

export function useSchedulePack(baseUrl: string | null): SchedulePackState {
  const [pack, setPack] = useState<SchedulePack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!baseUrl) {
      setPack(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getSchedulePack(baseUrl)
      .then((result) => {
        if (active) setPack(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the schedule");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [baseUrl, attempt]);

  const save = useCallback(
    async (next: SchedulePack) => {
      if (!baseUrl) throw new Error("Not connected to the bell");
      await replaceSchedulePack(baseUrl, next);
      setPack(next);
    },
    [baseUrl]
  );

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { pack, loading, error, reload, save };
}
