import type {
  CompleteProvisioningPayload,
  RegisterProvisioningIntentPayload
} from "./provisioning.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {};
  }

  return {
    [key]: value
  } as Record<K, V>;
}

export function parseRegisterProvisioningIntentPayload(
  body: unknown
): RegisterProvisioningIntentPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const method = readString(body, "method");

  if (method !== "ble" && method !== "ap") {
    return null;
  }

  return {
    method,
    ...optionalProp("pid", readString(body, "pid"))
  };
}

export function parseCompleteProvisioningPayload(
  body: unknown
): CompleteProvisioningPayload | null {
  if (!isRecord(body)) {
    return null;
  }

  const deviceId = readString(body, "deviceId");
  const status = readString(body, "status");

  if (!deviceId) {
    return null;
  }

  return {
    deviceId,
    ...optionalProp("pid", readString(body, "pid")),
    ...optionalProp(
      "status",
      status &&
        [
          "BLE_CONNECTED",
          "WIFI_SENT",
          "DEVICE_CONNECTING_WIFI",
          "DEVICE_CONNECTING_CLOUD",
          "MQTT_CONNECTED",
          "DEVICE_REGISTERED",
          "SUCCESS",
          "FAILED"
        ].includes(status)
        ? (status as CompleteProvisioningPayload["status"])
        : undefined
    )
  };
}
