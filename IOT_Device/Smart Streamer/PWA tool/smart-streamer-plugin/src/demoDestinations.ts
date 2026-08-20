/**
 * Shaped like GET /api/v1/streamer/destinations in VPS/API_CONTRACT.md §3.
 * No stream key field exists here at all — write-only server-side, same
 * rule as camera passwords.
 */
export type StreamerPlatform = "youtube" | "facebook" | "instagram";

export interface StreamerDestinationSummary {
  destinationId: string;
  platform: StreamerPlatform;
  displayName: string;
  credentialMode: "persistent" | "temporary" | "oauth";
  hasStreamKey: boolean;
  credentialExpiry: string | null;
  lastValidatedAt: string | null;
  enabled: boolean;
}

export const PLATFORM_LABELS: Record<StreamerPlatform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram"
};

export const DEMO_STREAMER_DESTINATIONS: StreamerDestinationSummary[] = [
  {
    destinationId: "DEST-00011",
    platform: "youtube",
    displayName: "Main Channel — YouTube",
    credentialMode: "persistent",
    hasStreamKey: true,
    credentialExpiry: null,
    lastValidatedAt: "2026-08-01T09:00:00Z",
    enabled: true
  },
  {
    destinationId: "DEST-00017",
    platform: "instagram",
    displayName: "Temple Live — IG",
    credentialMode: "temporary",
    hasStreamKey: true,
    credentialExpiry: "2026-08-04T20:00:00Z",
    lastValidatedAt: "2026-08-04T09:00:00Z",
    enabled: true
  }
];
