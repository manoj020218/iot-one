/** Float32 [-1,1] samples -> signed 16-bit little-endian PCM, per SOFT_PTT_CONTRACT.md. */
export function floatTo16BitPcm(samples: Float32Array): Int16Array {
  const output = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

/**
 * Mic callbacks arrive in whatever chunk size the browser's
 * ScriptProcessorNode gives us, which won't line up with the 20-40ms
 * frame size the device expects — this buffers samples and hands back
 * complete frames as soon as enough have accumulated, carrying any
 * remainder forward to the next push.
 */
export class FrameAccumulator {
  private pending: number[] = [];

  constructor(private readonly frameSamples: number) {}

  push(samples: Int16Array): Int16Array[] {
    for (let i = 0; i < samples.length; i++) {
      this.pending.push(samples[i] ?? 0);
    }

    const frames: Int16Array[] = [];
    while (this.pending.length >= this.frameSamples) {
      frames.push(Int16Array.from(this.pending.splice(0, this.frameSamples)));
    }
    return frames;
  }

  /** Call once when talk-hold releases, to send the last partial frame instead of discarding it. */
  flush(): Int16Array | null {
    if (this.pending.length === 0) {
      return null;
    }
    const frame = Int16Array.from(this.pending);
    this.pending = [];
    return frame;
  }
}
