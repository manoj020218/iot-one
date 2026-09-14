import { useCallback, useRef, useState } from "react";

import { AnnouncementSocket } from "./announcementSocket";
import { FrameAccumulator, floatTo16BitPcm } from "./pcmEncoder";
import { resampleLinear } from "./pcmResampler";
import { useMicCapture } from "./useMicCapture";

export type SoftPttState = "idle" | "connecting" | "requesting-mic" | "speaking" | "stopping" | "error";

const TARGET_SAMPLE_RATE = 22050;
/** ~29ms @ 22050Hz (640 samples = 1280 bytes) — inside the contract's 20-40ms/4096-byte window. */
const FRAME_SAMPLES = 640;

export interface SoftPttHandle {
  state: SoftPttState;
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Orchestrates SOFT_PTT_CONTRACT.md end to end: connect the WebSocket and
 * wait for "ready" *before* touching the mic, so there's no race between
 * the control handshake and the first binary frame — simpler to reason
 * about than trying to overlap them for a few tens of ms of latency.
 */
export function useSoftPtt(baseUrl: string | null): SoftPttHandle {
  const mic = useMicCapture();
  const socketRef = useRef<AnnouncementSocket | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const accumulatorRef = useRef(new FrameAccumulator(FRAME_SAMPLES));
  const [state, setState] = useState<SoftPttState>("idle");
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    mic.stop();
  }, [mic]);

  const start = useCallback(() => {
    if (!baseUrl) {
      setError("Not connected to the bell");
      setState("error");
      return;
    }

    setError(null);
    setState("connecting");
    accumulatorRef.current = new FrameAccumulator(FRAME_SAMPLES);

    const wsUrl = `${baseUrl.replace(/^http/, "ws")}/api/v1/announcement/ws`;
    const socket = new AnnouncementSocket(wsUrl);
    socketRef.current = socket;

    unsubscribeRef.current = socket.on((event) => {
      if (event.type === "ready") {
        setState("requesting-mic");
        mic
          .start((samples, sampleRate) => {
            const resampled = resampleLinear(samples, sampleRate, TARGET_SAMPLE_RATE);
            const pcm16 = floatTo16BitPcm(resampled);
            for (const frame of accumulatorRef.current.push(pcm16)) {
              socket.sendFrame(frame);
            }
          })
          .then(() => setState("speaking"))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Microphone access was denied");
            setState("error");
            cleanup();
          });
      } else if (event.type === "error") {
        setError(event.message);
        setState("error");
        cleanup();
      } else if (event.type === "stopped") {
        socket.close();
        mic.stop();
        setState("idle");
      } else if (event.type === "closed") {
        mic.stop();
        setState((current) => (current === "error" ? current : "idle"));
      }
    });

    socket.connect();
  }, [baseUrl, mic, cleanup]);

  const stop = useCallback(() => {
    setState("stopping");
    const remainder = accumulatorRef.current.flush();
    if (remainder) socketRef.current?.sendFrame(remainder);
    socketRef.current?.requestStop();
    // Device is expected to reply "stopped" (handled above); this is a
    // safety net so the UI doesn't hang forever if that reply never arrives.
    setTimeout(() => {
      if (socketRef.current) cleanup();
      setState((current) => (current === "stopping" ? "idle" : current));
    }, 2000);
  }, [cleanup]);

  return { state, error, start, stop };
}
