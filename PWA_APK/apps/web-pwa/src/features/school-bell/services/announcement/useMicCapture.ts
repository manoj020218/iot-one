import { useCallback, useRef } from "react";

export type MicChunkListener = (samples: Float32Array, sampleRate: number) => void;

export interface MicCaptureHandle {
  start: (onChunk: MicChunkListener) => Promise<void>;
  stop: () => void;
}

/**
 * getUserMedia + a ScriptProcessorNode tap, nothing more — resampling to
 * 22050 Hz and PCM16 encoding happen one layer up in useSoftPtt.ts, kept
 * separate so this file stays a plain "give me raw mic frames" primitive.
 * ScriptProcessorNode is deprecated in favor of AudioWorklet, but
 * AudioWorklet needs its own loadable module file, which doesn't fit this
 * plugin's single self-registering remoteEntry.js bundle — fine to
 * revisit if the real-device latency test calls for it.
 */
export function useMicCapture(): MicCaptureHandle {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const start = useCallback(async (onChunk: MicChunkListener) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    streamRef.current = stream;

    const context = new AudioContext();
    contextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(2048, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (event) => {
      onChunk(event.inputBuffer.getChannelData(0).slice(), context.sampleRate);
    };

    // Muted tap into destination — some browsers only fire onaudioprocess
    // once the graph reaches an active output node.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(context.destination);
  }, []);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return { start, stop };
}
