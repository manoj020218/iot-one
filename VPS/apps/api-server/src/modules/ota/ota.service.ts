import type {
  DeviceRecord,
  DeviceFirmwarePlanResponse,
  OtaReleaseChannel,
  OtaReleaseRecord,
  OtaReleaseSummary,
  OtaResolutionResult
} from "@jenix/shared";

import { getPid } from "../pid/pid.service";
import { otaRepository } from "./ota.model";
import type {
  CreateOtaReleaseInput,
  OtaActorContext,
  OtaModuleState
} from "./ota.types";
import { OtaModuleError } from "./ota.types";

function compareVersionParts(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index]! : 0;
    const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index]! : 0;

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return left.localeCompare(right);
}

function normalizeReleaseId(releaseId: string) {
  return releaseId.trim().toUpperCase();
}

function normalizePid(pid: string) {
  return pid.trim().toUpperCase();
}

function normalizeHardwareRevision(hardwareRevision: string) {
  return hardwareRevision.trim().toUpperCase();
}

function toReleaseSummary(record: OtaReleaseRecord): OtaReleaseSummary {
  return {
    releaseId: record.releaseId,
    pid: record.pid,
    hardwareRevision: record.hardwareRevision,
    version: record.version,
    channel: record.channel,
    artifactUrl: record.artifactUrl,
    checksum: record.checksum,
    status: record.status,
    ...(record.notes ? { notes: record.notes } : {}),
    ...(record.publishedAt ? { publishedAt: record.publishedAt } : {})
  };
}

async function requireRelease(releaseId: string): Promise<OtaReleaseRecord> {
  const record = await otaRepository.get(normalizeReleaseId(releaseId));

  if (!record) {
    throw new OtaModuleError(404, `OTA release not found: ${normalizeReleaseId(releaseId)}`);
  }

  return record;
}

async function getDeviceHardwareRevision(device: DeviceRecord): Promise<string> {
  if (device.hardwareRevision?.trim()) {
    return normalizeHardwareRevision(device.hardwareRevision);
  }

  return normalizeHardwareRevision(
    (await getPid(device.pid)).hardware.hardwareRevision
  );
}

async function listPublishedMatchingReleases(
  device: DeviceRecord,
  channel: OtaReleaseChannel
) {
  const hardwareRevision = await getDeviceHardwareRevision(device);

  return (await otaRepository.list())
    .filter(
      (release) =>
        release.status === "published" &&
        release.pid === normalizePid(device.pid) &&
        release.hardwareRevision === hardwareRevision &&
        release.channel === channel
    )
    .sort((left, right) => compareVersionParts(right.version, left.version));
}

async function resolveReleaseRecord(
  device: DeviceRecord,
  channel: OtaReleaseChannel,
  targetVersion?: string
): Promise<OtaReleaseRecord | undefined> {
  const releases = await listPublishedMatchingReleases(device, channel);

  if (!targetVersion) {
    return releases[0];
  }

  return releases.find((release) => release.version === targetVersion.trim());
}

export async function listOtaReleases(): Promise<OtaReleaseRecord[]> {
  return (await otaRepository.list()).sort((left, right) =>
    left.releaseId.localeCompare(right.releaseId)
  );
}

export async function getOtaRelease(releaseId: string): Promise<OtaReleaseRecord> {
  return requireRelease(releaseId);
}

export async function createOtaRelease(
  input: CreateOtaReleaseInput,
  actor: OtaActorContext
): Promise<OtaReleaseRecord> {
  const releaseId = normalizeReleaseId(input.releaseId);

  if (await otaRepository.get(releaseId)) {
    throw new OtaModuleError(409, `OTA release already exists: ${releaseId}`);
  }

  const pid = await getPid(input.pid);
  const timestamp = new Date().toISOString();
  const normalizedHardwareRevision = normalizeHardwareRevision(input.hardwareRevision);

  if (
    pid.hardware.hardwareRevision &&
    normalizeHardwareRevision(pid.hardware.hardwareRevision) !== normalizedHardwareRevision
  ) {
    throw new OtaModuleError(
      409,
      `Hardware revision mismatch for PID ${pid.pid}: expected ${normalizeHardwareRevision(pid.hardware.hardwareRevision)}`
    );
  }

  const record: OtaReleaseRecord = {
    releaseId,
    pid: pid.pid,
    hardwareRevision: normalizedHardwareRevision,
    version: input.version.trim(),
    channel: input.channel,
    artifactUrl: input.artifactUrl.trim(),
    checksum: input.checksum.trim(),
    status: input.status ?? "draft",
    createdBy: actor.actorId,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(input.notes ? { notes: input.notes.trim() } : {}),
    ...(input.status === "published" ? { publishedAt: timestamp } : {})
  };

  return otaRepository.save(record);
}

export async function resolveOtaReleaseForDevice(
  device: DeviceRecord,
  channel: OtaReleaseChannel,
  targetVersion?: string
): Promise<OtaResolutionResult> {
  const hardwareRevision = await getDeviceHardwareRevision(device);
  const release = await resolveReleaseRecord(device, channel, targetVersion);

  if (!release) {
    return {
      deviceId: device.deviceId,
      pid: device.pid,
      hardwareRevision,
      channel,
      status: "no_match",
      ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
      reason: targetVersion
        ? `No published ${channel} release ${targetVersion.trim()} matches PID ${device.pid}`
        : `No published ${channel} release matches PID ${device.pid} and hardware ${hardwareRevision}`
    };
  }

  const status =
    device.firmwareVersion === release.version ? "up_to_date" : "update_available";

  return {
    deviceId: device.deviceId,
    pid: device.pid,
    hardwareRevision,
    channel,
    status,
    ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
    release: toReleaseSummary(release)
  };
}

export async function getDeviceFirmwarePlan(
  device: DeviceRecord
): Promise<DeviceFirmwarePlanResponse> {
  const stable = await resolveOtaReleaseForDevice(device, "stable");
  const beta = await resolveOtaReleaseForDevice(device, "beta");
  const recommendedChannel =
    stable.status === "update_available"
      ? "stable"
      : beta.status === "update_available"
        ? "beta"
        : stable.release
          ? "stable"
          : "beta";

  return {
    deviceId: device.deviceId,
    pid: device.pid,
    hardwareRevision: await getDeviceHardwareRevision(device),
    ...(device.firmwareVersion ? { currentVersion: device.firmwareVersion } : {}),
    recommendedChannel,
    stable,
    beta
  };
}

export const otaTesting = {
  reset() {
    return otaRepository.reset();
  },
  async snapshot(): Promise<OtaModuleState> {
    return {
      releases: await listOtaReleases()
    };
  }
};
