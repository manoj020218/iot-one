/**
 * Linear-interpolation downsampler. The phone mic's native AudioContext
 * rate (commonly 44100/48000 Hz) must become exactly 22050 Hz mono per
 * SOFT_PTT_CONTRACT.md — voice-quality linear interpolation is plenty
 * for a PA announcement, no need for a real resampling library here.
 */
export function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) {
    return input;
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const lowerIndex = Math.floor(sourceIndex);
    const fraction = sourceIndex - lowerIndex;
    const lower = input[lowerIndex] ?? 0;
    const upper = input[lowerIndex + 1] ?? lower;
    output[i] = lower + (upper - lower) * fraction;
  }

  return output;
}
