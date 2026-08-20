// PWA-facing shape — matches VPS/API_CONTRACT.md §3. streamKey is
// intentionally absent: write-only, never returned by any GET.
export type StreamerPlatform = "youtube" | "facebook" | "instagram";
export type CredentialMode = "persistent" | "temporary" | "oauth";

export interface StreamerDestinationSummary {
  destinationId: string;
  homeId: string;
  platform: StreamerPlatform;
  displayName: string;
  // Channel name (YouTube) / page name (Facebook) / account label
  // (Instagram) — one label field, meaning depends on platform
  // (Streamer Plugin.txt §9 gives each platform a different name for it).
  platformLabel: string | null;
  serverUrl: string;
  credentialMode: CredentialMode;
  hasStreamKey: boolean;
  credentialExpiry: string | null;
  lastValidatedAt: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Internal record — the one place streamKey actually lives. Same
// not-really-encrypted-at-rest caveat as camera.types.ts's password field.
export interface StreamerDestinationRecord extends StreamerDestinationSummary {
  streamKey: string | null;
}

export interface CreateDestinationInput {
  platform: StreamerPlatform;
  displayName: string;
  platformLabel?: string;
  serverUrl: string;
  streamKey?: string;
  credentialMode?: CredentialMode;
  credentialExpiry?: string;
  enabled?: boolean;
}

export type UpdateDestinationInput = Partial<CreateDestinationInput>;

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
  lastValidatedAt: string | null;
}

export class StreamerDestinationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "StreamerDestinationError";
  }
}
