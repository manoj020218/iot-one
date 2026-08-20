import { randomUUID } from "node:crypto";

import { getCamera } from "../cameras/camera.service";
import { getDestination } from "../destinations/destination.service";
import type { DeviceRequestContext, SmartStreamerPlatformDeps } from "../platform-deps";
import { sessionRepository } from "./session.model";
import type { StartSessionInput, StopSessionInput, StreamerSessionSummary } from "./session.types";
import { StreamerSessionError } from "./session.types";

function createSessionId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SES-${date}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

async function requireOwnedSession(sessionId: string, homeId: string): Promise<StreamerSessionSummary> {
  const session = await sessionRepository.get(sessionId);

  if (!session || session.homeId !== homeId) {
    throw new StreamerSessionError(404, "SESSION_NOT_FOUND", `Session not found: ${sessionId}`);
  }

  return session;
}

export async function startSession(
  deps: SmartStreamerPlatformDeps,
  deviceId: string,
  homeId: string,
  input: StartSessionInput,
  context: DeviceRequestContext
): Promise<{ sessionId: string; status: StreamerSessionSummary["status"] }> {
  // Idempotent retry: same requestId returns the original result instead
  // of creating a second session (VPS/API_CONTRACT.md §5).
  if (input.requestId) {
    const existingSessionId = await sessionRepository.getByRequestId(input.requestId);
    if (existingSessionId) {
      const existing = await sessionRepository.get(existingSessionId);
      if (existing) {
        return { sessionId: existing.sessionId, status: existing.status };
      }
    }
  }

  const camera = await getCamera(input.cameraId, homeId);
  const destination = await getDestination(input.destinationId, homeId);

  if (!destination.enabled) {
    throw new StreamerSessionError(
      422,
      "DESTINATION_CREDENTIAL_EXPIRED",
      `Destination is disabled: ${destination.destinationId}`
    );
  }

  const activeOnDevice = await sessionRepository.findActiveByDevice(deviceId);
  if (activeOnDevice) {
    throw new StreamerSessionError(
      409,
      "DEVICE_ALREADY_STREAMING",
      "This Smart Streamer is already live.",
      { activeSessionId: activeOnDevice.sessionId, activePlatform: activeOnDevice.platform }
    );
  }

  const activeOnDestination = await sessionRepository.findActiveByDestination(input.destinationId);
  if (activeOnDestination) {
    throw new StreamerSessionError(
      409,
      "DESTINATION_LOCKED",
      "Another device is already streaming to this destination.",
      { activeSessionId: activeOnDestination.sessionId, activeDeviceId: activeOnDestination.deviceId }
    );
  }

  const now = new Date().toISOString();
  const session: StreamerSessionSummary = {
    sessionId: createSessionId(),
    homeId,
    deviceId,
    cameraId: camera.cameraId,
    destinationId: destination.destinationId,
    platform: destination.platform,
    status: "REQUESTED",
    triggerSource: input.triggerSource ?? "manual",
    videoMode: null,
    audioMode: null,
    connectionStatus: null,
    reconnectCount: 0,
    currentBitrateKbps: null,
    startTime: now,
    plannedStopAt: input.plannedStopAt ?? null,
    stoppedAt: null,
    stopReason: null,
    errorCode: null
  };

  await sessionRepository.save(session);
  if (input.requestId) {
    await sessionRepository.saveRequestId(input.requestId, session.sessionId);
  }

  // Trigger only — device still calls the firmware-facing
  // sessions/authorize endpoint (firmware/API_CONTRACT.md §5) to actually
  // get RTMPS credentials. That endpoint doesn't exist in this module yet
  // (device-facing, HMAC-signed — see task #14).
  await deps.dispatchDeviceUiCommand(
    deviceId,
    {
      command: "start_stream",
      payload: { sessionId: session.sessionId, cameraId: camera.cameraId, destinationId: destination.destinationId },
      requiresAck: true
    },
    context
  );

  return { sessionId: session.sessionId, status: session.status };
}

async function requireActiveDeviceSession(
  deviceId: string,
  homeId: string,
  sessionId: string
): Promise<StreamerSessionSummary> {
  const session = await requireOwnedSession(sessionId, homeId);

  if (session.deviceId !== deviceId) {
    throw new StreamerSessionError(404, "SESSION_NOT_FOUND", `Session not found for device: ${sessionId}`);
  }

  return session;
}

export async function stopSession(
  deps: SmartStreamerPlatformDeps,
  deviceId: string,
  homeId: string,
  input: StopSessionInput,
  context: DeviceRequestContext
): Promise<StreamerSessionSummary> {
  const session = await requireActiveDeviceSession(deviceId, homeId, input.sessionId);

  if (session.status === "STOPPED" || session.status === "FAILED") {
    throw new StreamerSessionError(
      409,
      "SESSION_ALREADY_STOPPED",
      `Session already stopped: ${session.sessionId}`
    );
  }

  const updated: StreamerSessionSummary = {
    ...session,
    status: "STOP_REQUESTED",
    stopReason: input.reason ?? "user"
  };
  await sessionRepository.save(updated);

  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "stop_stream", payload: { sessionId: session.sessionId }, requiresAck: true },
    context
  );

  return updated;
}

/**
 * "Only the session owner may stop or modify an active session unless an
 * administrator issues a force-stop command" (firmware prompt §3) — this
 * is that escape hatch. Requires smart_streamer.stream.force_stop and
 * must always be audit-logged (Streamer Plugin.txt §17/§27). Neither
 * permission check nor audit logging is enforced here yet: there's no
 * RBAC-by-claims or cross-module audit log in the platform today (see
 * SMART_STREAMER_PLATFORM_ADDITIONS.md items 2 and 4) — do not treat this
 * endpoint as access-controlled until those land.
 */
export async function forceStopSession(
  deps: SmartStreamerPlatformDeps,
  deviceId: string,
  homeId: string,
  sessionId: string,
  context: DeviceRequestContext
): Promise<StreamerSessionSummary> {
  const session = await requireActiveDeviceSession(deviceId, homeId, sessionId);

  const updated: StreamerSessionSummary = {
    ...session,
    status: "STOPPING",
    stopReason: "force_stop"
  };
  await sessionRepository.save(updated);

  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "stop_stream", payload: { sessionId: session.sessionId, forced: true }, requiresAck: true },
    context
  );

  return updated;
}

export async function getSession(sessionId: string, homeId: string): Promise<StreamerSessionSummary> {
  return requireOwnedSession(sessionId, homeId);
}
