import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceFilePath = fileURLToPath(import.meta.url);
const sourceDir = path.dirname(sourceFilePath);
const backendRootDir = path.resolve(sourceDir, "..");

export function createRuntimeConfig(overrides = {}) {
  const port = overrides.port ?? parseInteger(process.env.PORT, 4180);
  const publicBaseUrl = overrides.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? "";
  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? path.join(backendRootDir, "data");
  const ffmpegBin = overrides.ffmpegBin ?? process.env.FFMPEG_BIN ?? "ffmpeg";
  const ytDlpBin = overrides.ytDlpBin ?? process.env.YT_DLP_BIN ?? "yt-dlp";
  const maxUploadBytes = overrides.maxUploadBytes ?? parseInteger(process.env.MAX_UPLOAD_BYTES, 32 * 1024 * 1024);

  return {
    backendRootDir,
    port,
    publicBaseUrl,
    dataDir,
    profileStorePath: path.join(dataDir, "audio-profiles.json"),
    micChannelDir: path.join(dataDir, "mic-channels"),
    ffmpegBin,
    ytDlpBin,
    maxUploadBytes,
    canonicalWave: {
      format: "wav",
      sampleRate: 22050,
      channels: 1,
      bitsPerSample: 16
    }
  };
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
