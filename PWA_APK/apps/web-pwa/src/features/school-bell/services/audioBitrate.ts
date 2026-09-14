/**
 * Bell clips are short, spoken/tone content, not commercial HiFi music —
 * 64-96kbps mono is plenty and keeps the internal-flash budget (~6.8MB,
 * see FIRMWARE_TASKS_APK_INTEGRATION.md Task 1) stretching across many
 * more bells. Decoding via AudioContext gives a real duration to compute
 * effective bitrate from, not a guess based on the file extension alone.
 */
export const RECOMMENDED_MAX_BITRATE_KBPS = 96;

export async function estimateBitrateKbps(file: Blob): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const context = new AudioContext();
    try {
      const audioBuffer = await context.decodeAudioData(arrayBuffer);
      if (audioBuffer.duration <= 0) return null;
      return Math.round((file.size * 8) / audioBuffer.duration / 1000);
    } finally {
      void context.close();
    }
  } catch {
    // Some browsers/webviews can't decode every container this way — treat as "unknown", not an error.
    return null;
  }
}
