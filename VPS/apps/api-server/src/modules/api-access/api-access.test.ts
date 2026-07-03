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
