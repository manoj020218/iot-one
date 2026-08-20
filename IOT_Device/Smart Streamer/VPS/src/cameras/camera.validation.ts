import type { CreateCameraInput, UpdateCameraInput } from "./camera.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readTransport(body: Record<string, unknown>): "tcp" | "udp" | undefined {
  const value = body.transport;
  return value === "tcp" || value === "udp" ? value : undefined;
}

function optionalProp<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

export function parseCreateCameraInput(body: unknown): CreateCameraInput | null {
  if (!isRecord(body)) {
    return null;
  }

  const friendlyName = readString(body, "friendlyName");
  const rtspHost = readString(body, "rtspHost");
  const rtspPort = readNumber(body, "rtspPort");
  const rtspPath = readString(body, "rtspPath");

  if (!friendlyName || !rtspHost || rtspPort === undefined || !rtspPath) {
    return null;
  }

  return {
    friendlyName,
    rtspHost,
    rtspPort,
    rtspPath,
    ...optionalProp("rtspUsername", readString(body, "rtspUsername")),
    ...optionalProp("rtspPassword", readString(body, "rtspPassword")),
    ...optionalProp("mainStreamUrl", readString(body, "mainStreamUrl")),
    ...optionalProp("subStreamUrl", readString(body, "subStreamUrl")),
    ...optionalProp("videoCodec", readString(body, "videoCodec")),
    ...optionalProp("audioCodec", readString(body, "audioCodec")),
    ...optionalProp("rotation", readNumber(body, "rotation")),
    ...optionalProp("transport", readTransport(body)),
    ...optionalProp("connectionTimeoutSeconds", readNumber(body, "connectionTimeoutSeconds"))
  };
}

export function parseUpdateCameraInput(body: unknown): UpdateCameraInput | null {
  if (!isRecord(body)) {
    return null;
  }

  return {
    ...optionalProp("friendlyName", readString(body, "friendlyName")),
    ...optionalProp("rtspHost", readString(body, "rtspHost")),
    ...optionalProp("rtspPort", readNumber(body, "rtspPort")),
    ...optionalProp("rtspPath", readString(body, "rtspPath")),
    ...optionalProp("rtspUsername", readString(body, "rtspUsername")),
    ...optionalProp("rtspPassword", readString(body, "rtspPassword")),
    ...optionalProp("mainStreamUrl", readString(body, "mainStreamUrl")),
    ...optionalProp("subStreamUrl", readString(body, "subStreamUrl")),
    ...optionalProp("videoCodec", readString(body, "videoCodec")),
    ...optionalProp("audioCodec", readString(body, "audioCodec")),
    ...optionalProp("rotation", readNumber(body, "rotation")),
    ...optionalProp("transport", readTransport(body)),
    ...optionalProp("connectionTimeoutSeconds", readNumber(body, "connectionTimeoutSeconds"))
  };
}

export function parseAssignCameraInput(body: unknown): { deviceId: string } | null {
  if (!isRecord(body)) {
    return null;
  }

  const deviceId = readString(body, "deviceId");
  return deviceId ? { deviceId } : null;
}

export function parseTestCameraInput(body: unknown): { deviceId: string } | null {
  return parseAssignCameraInput(body);
}
