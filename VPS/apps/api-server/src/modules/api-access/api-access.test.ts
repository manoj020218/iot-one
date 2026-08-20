import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { apiAccessTesting } from "./api-access.service";
import { deviceTesting } from "../devices/device.service";
import { homeTesting } from "../homes/home.service";
import { pidTesting } from "../pid/pid.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "api-access-tests"
};

async function createApiEnabledPid(pid: string, allowedScopes: string[]) {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid,
      status: "beta",
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      },
      api: {
        enabled: true,
        sellable: true,
        defaultPackageId: `${pid}-DEFAULT`,
        allowedScopes,
        webhookSupport: true,
        mqttBridgeSupport: false
      }
    });
}

async function createPackage(packageId: string, pid: string, scopes: string[]) {
  const response = await request(createApp())
    .post("/api/v1/admin/api-packages")
    .set(developerHeaders)
    .send({
      packageId,
      pid,
      name: `${pid} Package`,
      status: "active",
      scopes
    });

  expect(response.status).toBe(201);
}

async function createApiKey(
  homeOwnerHeaders: Record<string, string>,
  packageId: string,
  scopes?: string[]
) {
  const response = await request(createApp())
    .post("/api/v1/api-keys")
    .set(homeOwnerHeaders)
    .send({
      packageId,
      label: "Integration Key",
      ...(scopes ? { scopes } : {})
    });

  expect(response.status).toBe(201);
  return response.body.data.secret as string;
}

describe("api access routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await apiAccessTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
  });

  it("returns public device state when the API key has the required scope", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "API Owner",
      email: "api-owner@example.com"
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    const homeId = ownerSession.activeHomeId!;
    await createApiEnabledPid("JNX-TG-C3-701", ["devices:read", "devices:write"]);
    await createPackage("TG-PUBLIC-READWRITE", "JNX-TG-C3-701", [
      "devices:read",
      "devices:write"
    ]);
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-b001",
      pid: "JNX-TG-C3-701",
      homeId,
      ownerUserId: ownerSession.user.userId,
      displayName: "Public Tank"
    });
    const secret = await createApiKey(homeOwnerHeaders, "TG-PUBLIC-READWRITE");

    const response = await request(createApp())
      .get("/api/v1/public/devices/JNX-TG-B001/state")
      .set({
        "x-api-key": secret
      });

    expect(response.status).toBe(200);
    expect(response.body.data.deviceId).toBe("JNX-TG-B001");
    expect(response.body.data.packageId).toBe("TG-PUBLIC-READWRITE");
  });

  it("denies a public command when the API key lacks the required scope", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "API Owner",
      email: "api-owner@example.com"
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    const homeId = ownerSession.activeHomeId!;
    await createApiEnabledPid("JNX-TG-C3-702", ["devices:read", "devices:write"]);
    await createPackage("TG-PUBLIC-LIMITED", "JNX-TG-C3-702", [
      "devices:read",
      "devices:write"
    ]);
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-b002",
      pid: "JNX-TG-C3-702",
      homeId,
      ownerUserId: ownerSession.user.userId,
      displayName: "Limited Tank"
    });
    const secret = await createApiKey(
      homeOwnerHeaders,
      "TG-PUBLIC-LIMITED",
      ["devices:read"]
    );

    const response = await request(createApp())
      .post("/api/v1/public/devices/JNX-TG-B002/commands")
      .set({
        "x-api-key": secret
      })
      .send({
        command: "refresh_status"
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/scope/i);
  });

  it("denies access when the API package PID does not match the target device PID", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "API Owner",
      email: "api-owner@example.com"
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    const homeId = ownerSession.activeHomeId!;
    await createApiEnabledPid("JNX-TG-C3-703", ["devices:read"]);
    await createApiEnabledPid("JNX-TG-C3-704", ["devices:read"]);
    await createPackage("TG-PUBLIC-703", "JNX-TG-C3-703", ["devices:read"]);
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-b003",
      pid: "JNX-TG-C3-703",
      homeId,
      ownerUserId: ownerSession.user.userId,
      displayName: "PID 703 Tank"
    });
    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-b004",
      pid: "JNX-TG-C3-704",
      homeId,
      ownerUserId: ownerSession.user.userId,
      displayName: "PID 704 Tank"
    });
    const secret = await createApiKey(homeOwnerHeaders, "TG-PUBLIC-703");

    const response = await request(createApp())
      .get("/api/v1/public/devices/JNX-TG-B004/state")
      .set({
        "x-api-key": secret
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/pid/i);
  });
});

describe("vendor device API (x-api-key only, no Jenix user session)", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await apiAccessTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
  });

  async function setUpVendorPackage(pid: string, packageId: string, scopes: string[]) {
    const ownerSession = await createAuthenticatedSession({
      name: "Vendor Pool Owner",
      email: `${packageId.toLowerCase()}-owner@example.com`
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    await createApiEnabledPid(pid, ["devices:read", "devices:write"]);
    await createPackage(packageId, pid, scopes);
    const secret = await createApiKey(homeOwnerHeaders, packageId, scopes);
    return { ownerSession, homeOwnerHeaders, secret, homeId: ownerSession.activeHomeId! };
  }

  it("registers a device into the key's own HOME, and is idempotent on re-registration", async () => {
    const { secret } = await setUpVendorPackage(
      "JNX-VEN-C3-801",
      "VEN-801-WRITE",
      ["devices:read", "devices:write"]
    );

    const first = await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secret })
      .send({ deviceId: "aa11bb22cc33", displayName: "Vendor Device" });

    expect(first.status).toBe(201);
    expect(first.body.data.deviceId).toBe("AA11BB22CC33");
    expect(first.body.data.pid).toBe("JNX-VEN-C3-801");

    const second = await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secret })
      .send({ deviceId: "aa11bb22cc33" });

    expect(second.status).toBe(201);
    expect(second.body.data.deviceId).toBe("AA11BB22CC33");
  });

  it("rejects registering a deviceId that already belongs to a different HOME", async () => {
    const { secret: secretA } = await setUpVendorPackage(
      "JNX-VEN-C3-802",
      "VEN-802-WRITE",
      ["devices:read", "devices:write"]
    );
    const { secret: secretB } = await setUpVendorPackage(
      "JNX-VEN-C3-802",
      "VEN-802-WRITE-B",
      ["devices:read", "devices:write"]
    );

    await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secretA })
      .send({ deviceId: "dd44ee55ff66" });

    const conflict = await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secretB })
      .send({ deviceId: "dd44ee55ff66" });

    expect(conflict.status).toBe(409);
  });

  it("lists only the key's own HOME devices for its own PID", async () => {
    const { secret } = await setUpVendorPackage(
      "JNX-VEN-C3-803",
      "VEN-803-READ",
      ["devices:read", "devices:write"]
    );

    await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secret })
      .send({ deviceId: "112233445566" });

    const response = await request(createApp())
      .get("/api/v1/public/devices")
      .set({ "x-api-key": secret });

    expect(response.status).toBe(200);
    expect(response.body.data.devices).toHaveLength(1);
    expect(response.body.data.devices[0].deviceId).toBe("112233445566");
  });
});

describe("vendor access to QRunlock — routes through the plugin's own guarded unlock, not a generic dispatch", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await apiAccessTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
  });

  it("unlocks through the guarded path, then rejects a second immediate unlock with the plugin's own cooldown error", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "QRunlock Vendor Pool",
      email: "qrunlock-vendor@example.com"
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    await createApiEnabledPid("JNX-QRU-C3-001", ["devices:read", "devices:write"]);
    await createPackage("QRUNLOCK-VENDOR", "JNX-QRU-C3-001", ["devices:read", "devices:write"]);
    const secret = await createApiKey(homeOwnerHeaders, "QRUNLOCK-VENDOR");

    const registered = await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secret })
      .send({ deviceId: "aabbccddeeff" });
    expect(registered.status).toBe(201);
    const deviceId = registered.body.data.deviceId as string;

    const unlock = await request(createApp())
      .post(`/api/v1/public/devices/${deviceId}/commands`)
      .set({ "x-api-key": secret })
      .send({ command: "unlock" });

    expect(unlock.status).toBe(200);
    expect(unlock.body.data.status).toBe("requested");
    expect(unlock.body.data.deviceId).toBe(deviceId);

    const secondUnlock = await request(createApp())
      .post(`/api/v1/public/devices/${deviceId}/commands`)
      .set({ "x-api-key": secret })
      .send({ command: "unlock" });

    expect(secondUnlock.status).toBe(409);
    expect(secondUnlock.body.error.code).toBe("UNLOCK_COOLDOWN_ACTIVE");

    const logs = await request(createApp())
      .get(`/api/v1/public/devices/${deviceId}/logs`)
      .set({ "x-api-key": secret });

    expect(logs.status).toBe(200);
    expect(logs.body.data[0].type).toBe("unlock");
    expect(logs.body.data[0].source).toBe("api:QRUNLOCK-VENDOR");
  });

  it("rejects an unsupported command for QRunlock instead of silently accepting on/off", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "QRunlock Vendor Pool 2",
      email: "qrunlock-vendor-2@example.com"
    });
    const homeOwnerHeaders = createAuthHeaders(ownerSession);
    await createApiEnabledPid("JNX-QRU-C3-001", ["devices:read", "devices:write"]);
    await createPackage("QRUNLOCK-VENDOR-2", "JNX-QRU-C3-001", ["devices:read", "devices:write"]);
    const secret = await createApiKey(homeOwnerHeaders, "QRUNLOCK-VENDOR-2");

    const registered = await request(createApp())
      .post("/api/v1/public/devices/register")
      .set({ "x-api-key": secret })
      .send({ deviceId: "112211221122" });
    const deviceId = registered.body.data.deviceId as string;

    const response = await request(createApp())
      .post(`/api/v1/public/devices/${deviceId}/commands`)
      .set({ "x-api-key": secret })
      .send({ command: "on" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("UNSUPPORTED_COMMAND");
  });
});
