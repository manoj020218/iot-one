const AUDIO_SOURCE_TYPES = [
  "youtube",
  "url",
  "vps",
  "file",
  "sip",
  "rtp",
  "browser-mic",
  "app-mic"
];

export function validateAudioProfileInput(payload, defaults) {
  if (!isPlainObject(payload)) {
    return { ok: false, error: "Profile payload must be an object" };
  }

  const name = normalizeRequiredString(payload.name, "name");
  const sourceType = normalizeRequiredString(payload.sourceType, "sourceType");
  if (!AUDIO_SOURCE_TYPES.includes(sourceType)) {
    return { ok: false, error: `sourceType must be one of: ${AUDIO_SOURCE_TYPES.join(", ")}` };
  }

  const input = normalizeInput(payload.input, sourceType);
  if (!input.ok) return input;

  const output = normalizeOutput(payload.output, defaults);
  if (!output.ok) return output;

  const tools = normalizeTools(payload.tools, defaults);
  if (!tools.ok) return tools;

  return {
    ok: true,
    value: {
      name,
      sourceType,
      enabled: payload.enabled !== false,
      notes: normalizeOptionalString(payload.notes),
      input: input.value,
      output: output.value,
      tools: tools.value
    }
  };
}

export function supportedSourceTypes() {
  return [...AUDIO_SOURCE_TYPES];
}

function normalizeInput(value, sourceType) {
  if (!isPlainObject(value)) {
    return { ok: false, error: "input must be an object" };
  }

  const normalized = {
    url: normalizeOptionalString(value.url),
    youtubeUrl: normalizeOptionalString(value.youtubeUrl),
    filePath: normalizeOptionalString(value.filePath),
    rtpUrl: normalizeOptionalString(value.rtpUrl),
    sdpPath: normalizeOptionalString(value.sdpPath),
    sipUri: normalizeOptionalString(value.sipUri),
    bridgeCommand: normalizeOptionalString(value.bridgeCommand),
    bridgeArgs: normalizeStringArray(value.bridgeArgs),
    micChannelId: normalizeOptionalString(value.micChannelId),
    headers: normalizeHeaderMap(value.headers)
  };

  switch (sourceType) {
    case "url":
    case "vps":
      if (!normalized.url) return { ok: false, error: `${sourceType} profiles require input.url` };
      break;
    case "youtube":
      if (!normalized.youtubeUrl) return { ok: false, error: "youtube profiles require input.youtubeUrl" };
      break;
    case "file":
      if (!normalized.filePath) return { ok: false, error: "file profiles require input.filePath" };
      break;
    case "rtp":
      if (!normalized.rtpUrl && !normalized.sdpPath) {
        return { ok: false, error: "rtp profiles require input.rtpUrl or input.sdpPath" };
      }
      break;
    case "sip":
      if (!normalized.sipUri && !normalized.bridgeCommand) {
        return { ok: false, error: "sip profiles require input.sipUri or input.bridgeCommand" };
      }
      break;
    case "browser-mic":
    case "app-mic":
      if (!normalized.micChannelId) {
        return { ok: false, error: `${sourceType} profiles require input.micChannelId` };
      }
      break;
    default:
      break;
  }

  return { ok: true, value: normalized };
}

function normalizeOutput(value, defaults) {
  if (value !== undefined && !isPlainObject(value)) {
    return { ok: false, error: "output must be an object when provided" };
  }

  const source = value ?? {};
  const sampleRate = normalizePositiveInteger(source.sampleRate, defaults.canonicalWave.sampleRate);
  const channels = normalizePositiveInteger(source.channels, defaults.canonicalWave.channels);
  const bitsPerSample = normalizePositiveInteger(source.bitsPerSample, defaults.canonicalWave.bitsPerSample);
  const format = normalizeOptionalString(source.format) ?? defaults.canonicalWave.format;

  if (format !== "wav") {
    return { ok: false, error: "Only wav output is supported for firmware delivery" };
  }

  return {
    ok: true,
    value: {
      format,
      sampleRate,
      channels,
      bitsPerSample,
      extraInputArgs: normalizeStringArray(source.extraInputArgs),
      extraOutputArgs: normalizeStringArray(source.extraOutputArgs)
    }
  };
}

function normalizeTools(value, defaults) {
  if (value !== undefined && !isPlainObject(value)) {
    return { ok: false, error: "tools must be an object when provided" };
  }

  const source = value ?? {};
  return {
    ok: true,
    value: {
      ffmpegBin: normalizeOptionalString(source.ffmpegBin) ?? defaults.ffmpegBin,
      ytDlpBin: normalizeOptionalString(source.ytDlpBin) ?? defaults.ytDlpBin
    }
  };
}

function normalizeHeaderMap(value) {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, currentValue]) => key.trim().length > 0 && typeof currentValue === "string" && currentValue.trim().length > 0)
      .map(([key, currentValue]) => [key.trim(), currentValue.trim()])
  );
}

function normalizeRequiredString(value, fieldName) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }
  return normalized;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
