import { randomUUID } from "node:crypto";

import { destinationRepository } from "./destination.model";
import type {
  CreateDestinationInput,
  StreamerDestinationRecord,
  StreamerDestinationSummary,
  UpdateDestinationInput,
  ValidationResult
} from "./destination.types";
import { StreamerDestinationError } from "./destination.types";

function createDestinationId(): string {
  return `DEST-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toSummary(record: StreamerDestinationRecord): StreamerDestinationSummary {
  const { streamKey: _streamKey, ...summary } = record;
  return summary;
}

async function requireDestination(
  destinationId: string,
  homeId: string
): Promise<StreamerDestinationRecord> {
  const record = await destinationRepository.get(destinationId);

  if (!record || record.homeId !== homeId) {
    throw new StreamerDestinationError(404, `Destination not found: ${destinationId}`);
  }

  return record;
}

export async function listDestinations(homeId: string): Promise<StreamerDestinationSummary[]> {
  return (await destinationRepository.listByHome(homeId)).map(toSummary);
}

export async function getDestination(
  destinationId: string,
  homeId: string
): Promise<StreamerDestinationSummary> {
  return toSummary(await requireDestination(destinationId, homeId));
}

export async function createDestination(
  homeId: string,
  input: CreateDestinationInput
): Promise<StreamerDestinationSummary> {
  if (!input.serverUrl.startsWith("rtmps://")) {
    throw new StreamerDestinationError(422, "serverUrl must be an RTMPS URL");
  }

  const now = new Date().toISOString();
  const record: StreamerDestinationRecord = {
    destinationId: createDestinationId(),
    homeId,
    platform: input.platform,
    displayName: input.displayName,
    platformLabel: input.platformLabel ?? null,
    serverUrl: input.serverUrl,
    streamKey: input.streamKey ?? null,
    credentialMode: input.credentialMode ?? "persistent",
    hasStreamKey: Boolean(input.streamKey),
    credentialExpiry: input.credentialExpiry ?? null,
    lastValidatedAt: null,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now
  };

  return toSummary(await destinationRepository.save(record));
}

export async function updateDestination(
  destinationId: string,
  homeId: string,
  input: UpdateDestinationInput
): Promise<StreamerDestinationSummary> {
  const existing = await requireDestination(destinationId, homeId);
  const nextServerUrl = input.serverUrl ?? existing.serverUrl;

  if (!nextServerUrl.startsWith("rtmps://")) {
    throw new StreamerDestinationError(422, "serverUrl must be an RTMPS URL");
  }

  const nextStreamKey = input.streamKey ?? existing.streamKey;
  const updated: StreamerDestinationRecord = {
    ...existing,
    ...(input.platform !== undefined ? { platform: input.platform } : {}),
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.platformLabel !== undefined ? { platformLabel: input.platformLabel } : {}),
    serverUrl: nextServerUrl,
    streamKey: nextStreamKey,
    hasStreamKey: Boolean(nextStreamKey),
    ...(input.credentialMode !== undefined ? { credentialMode: input.credentialMode } : {}),
    ...(input.credentialExpiry !== undefined ? { credentialExpiry: input.credentialExpiry } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    updatedAt: new Date().toISOString()
  };

  return toSummary(await destinationRepository.save(updated));
}

export async function deleteDestination(destinationId: string, homeId: string): Promise<void> {
  await requireDestination(destinationId, homeId);
  // TODO(#12 schedules): reject with 409 if referenced by a schedule, once
  // the Schedules module exists to check against — honestly deferred, same
  // as camera.service.ts's deleteCamera.
  await destinationRepository.remove(destinationId);
}

export async function validateDestination(
  destinationId: string,
  homeId: string
): Promise<ValidationResult> {
  const existing = await requireDestination(destinationId, homeId);
  const reasons: string[] = [];

  if (!existing.serverUrl.startsWith("rtmps://")) {
    reasons.push("Server URL is not RTMPS.");
  }
  if (!existing.hasStreamKey) {
    reasons.push("No stream key is configured.");
  }
  if (existing.credentialExpiry && new Date(existing.credentialExpiry).getTime() < Date.now()) {
    reasons.push("Credential has expired.");
  }
  // Deliberately does not call YouTube/Facebook/Instagram APIs — VPS
  // prompt §10 forbids undocumented Instagram API use, and there's no
  // OAuth integration built for YouTube yet. This checks shape and
  // expiry only, not live reachability.

  const valid = reasons.length === 0;

  if (valid) {
    const validatedAt = new Date().toISOString();
    await destinationRepository.save({
      ...existing,
      lastValidatedAt: validatedAt,
      updatedAt: validatedAt
    });
    return { valid, reasons, lastValidatedAt: validatedAt };
  }

  return { valid, reasons, lastValidatedAt: existing.lastValidatedAt };
}
