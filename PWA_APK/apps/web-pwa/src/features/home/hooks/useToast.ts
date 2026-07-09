import { useCallback, useState } from "react";

export interface ToastState {
  id: number;
  title: string;
  detail: string;
}

/** Minimal transient toast — one at a time, auto-dismiss. */
export function useToast(durationMs = 2600) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback(
    (title: string, detail = "") => {
      const id = Date.now();
      setToast({ id, title, detail });
      setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, durationMs);
    },
    [durationMs]
  );

  return { toast, show };
}
