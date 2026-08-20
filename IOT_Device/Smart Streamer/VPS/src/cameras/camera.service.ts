import { randomUUID } from "node:crypto";

import type { DeviceRequestContext, SmartStreamerPlatformDeps } from "../platform-deps";
import { cameraRepository, cameraTestRepository } from "./camera.model";
import type {
  CameraTestSession,
  CameraTestStep,
  CreateCameraInput,
  StreamerCameraRecord,
  StreamerCameraSummary,
  UpdateCameraInput
} from "./camera.types";
import { StreamerCameraError } from "./camera.types";

function createCameraId(): string {
  return `CAM-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function toSummary(record: StreamerCameraRecord): StreamerCameraSummary {
  const { rtspUsername: _rtspUsername, rtspPassword: _rtspPassword, ...summary } = record;
  return summary;
}

async function requireCamera(cameraId: string, homeId: string): Promise<StreamerCameraRecord> {
  const record = await cameraRepository.get(cameraId);

  if (!record || record.homeId !== homeId) {
    throw new StreamerCameraError(404, `Camera not found: ${cameraId}`);
  }

  return record;
}

export async function listCameras(homeId: string): Promise<StreamerCameraSummary[]> {
  const records = await cameraRepository.listByHome(homeId);
  return records.map(toSummary);
}

export async function getCamera(cameraId: string, homeId: string): Promise<StreamerCameraSummary> {
  return toSummary(await requireCamera(cameraId, homeId));
}

export async function createCamera(
  homeId: string,
  input: CreateCameraInput
): Promise<StreamerCameraSummary> {
  const now = new Date().toISOString();
  const record: StreamerCameraRecord = {
    cameraId: createCameraId(),
    homeId,
    friendlyName: input.friendlyName,
    rtspHost: input.rtspHost,
    rtspPort: input.rtspPort,
    rtspPath: input.rtspPath,
    rtspUsername: input.rtspUsername ?? null,
    rtspPassword: input.rtspPassword ?? null,
    hasCredentials: Boolean(input.rtspUsername || input.rtspPassword),
    mainStreamUrl: input.mainStreamUrl ?? null,
    subStreamUrl: input.subStreamUrl ?? null,
    videoCodec: input.videoCodec ?? null,
    audioCodec: input.audioCodec ?? null,
    rotation: input.rotation ?? 0,
    transport: input.transport ?? "tcp",
    connectionTimeoutSeconds: input.connectionTimeoutSeconds ?? 5,
    assignedDeviceId: null,
    createdAt: now,
    updatedAt: now
  };

  return toSummary(await cameraRepository.save(record));
}

export async function updateCamera(
  cameraId: string,
  homeId: string,
  input: UpdateCameraInput
): Promise<StreamerCameraSummary> {
  const existing = await requireCamera(cameraId, homeId);
  const nextUsername = input.rtspUsername ?? existing.rtspUsername;
  const nextPassword = input.rtspPassword ?? existing.rtspPassword;

  const updated: StreamerCameraRecord = {
    ...existing,
    ...(input.friendlyName !== undefined ? { friendlyName: input.friendlyName } : {}),
    ...(input.rtspHost !== undefined ? { rtspHost: input.rtspHost } : {}),
    ...(input.rtspPort !== undefined ? { rtspPort: input.rtspPort } : {}),
    ...(input.rtspPath !== undefined ? { rtspPath: input.rtspPath } : {}),
    rtspUsername: nextUsername,
    rtspPassword: nextPassword,
    hasCredentials: Boolean(nextUsername || nextPassword),
    ...(input.mainStreamUrl !== undefined ? { mainStreamUrl: input.mainStreamUrl } : {}),
    ...(input.subStreamUrl !== undefined ? { subStreamUrl: input.subStreamUrl } : {}),
    ...(input.videoCodec !== undefined ? { videoCodec: input.videoCodec } : {}),
    ...(input.audioCodec !== undefined ? { audioCodec: input.audioCodec } : {}),
    ...(input.rotation !== undefined ? { rotation: input.rotation } : {}),
    ...(input.transport !== undefined ? { transport: input.transport } : {}),
    ...(input.connectionTimeoutSeconds !== undefined
      ? { connectionTimeoutSeconds: input.connectionTimeoutSeconds }
      : {}),
    updatedAt: new Date().toISOString()
  };

  return toSummary(await cameraRepository.save(updated));
}

export async function deleteCamera(cameraId: string, homeId: string): Promise<void> {
  const existing = await requireCamera(cameraId, homeId);

  if (existing.assignedDeviceId) {
    throw new StreamerCameraError(
      409,
      `Camera is assigned to device ${existing.assignedDeviceId}; unassign before deleting.`
    );
  }
  // TODO(#12 schedules): also reject if referenced by a schedule once the
  // Schedules module exists — not possible to check yet, honestly deferred.

  await cameraRepository.remove(cameraId);
}

export async function assignCamera(
  cameraId: string,
  homeId: string,
  deviceId: string
): Promise<StreamerCameraSummary> {
  const existing = await requireCamera(cameraId, homeId);
  const updated: StreamerCameraRecord = {
    ...existing,
    assignedDeviceId: deviceId,
    updatedAt: new Date().toISOString()
  };
  return toSummary(await cameraRepository.save(updated));
}

const TEST_STEPS: CameraTestStep["step"][] = [
  "reachable",
  "rtsp_auth",
  "video_codec",
  "audio_codec",
  "keyframe",
  "passthrough_compatible"
];

export async function startCameraTest(
  deps: SmartStreamerPlatformDeps,
  cameraId: string,
  homeId: string,
  deviceId: string,
  context: DeviceRequestContext
): Promise<CameraTestSession> {
  await requireCamera(cameraId, homeId);

  const now = new Date().toISOString();
  const session: CameraTestSession = {
    testId: `TEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    cameraId,
    deviceId,
    status: "in_progress",
    steps: TEST_STEPS.map((step) => ({ step, status: "pending" })),
    startedAt: now,
    updatedAt: now
  };

  await cameraTestRepository.save(session);

  // Fire-and-forget over the same generic UI-command channel Tank Guard's
  // "Zero Calibrate" uses — not a Scene action (test_camera isn't and
  // shouldn't be schedulable), so it never touches SceneActionCommand.
  // How results get back into this session (step-by-step) depends on the
  // device's cmd/ack or events channel, which nothing in this module
  // consumes yet — see README.md's known-gaps section. The session stays
  // "in_progress" until that ingestion path exists.
  await deps.dispatchDeviceUiCommand(
    deviceId,
    { command: "test_camera", payload: { cameraId, testId: session.testId }, requiresAck: true },
    context
  );

  return session;
}

export async function getCameraTest(testId: string): Promise<CameraTestSession> {
  const session = await cameraTestRepository.get(testId);

  if (!session) {
    throw new StreamerCameraError(404, `Test session not found: ${testId}`);
  }

  return session;
}
