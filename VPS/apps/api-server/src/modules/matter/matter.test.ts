import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { deviceTesting } from "../devices/device.service";
import { matterTesting } from "./matter.service";
import { pidTesting } from "../pid/pid.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "dev-phase-11"
};

const ownerHeaders = {
  "x-user-id": "user-matter-owner",
  "x-home-id": "home-user-matter-owner",
  "x-home-role": "owner"
};

const originalMatterRuntimeEnabled = process.env.MATTER_RUNTIME_ENABLED;

async function createMatterPid(
  pid: string,
  mode: "NATIVE_MATTER" | "MATTER_BRIDGE_GATEWAY" | "MATTER_BRIDGE_CHILD"
) {
  await request(createApp())
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send({
      ...foundationPidBlueprint,
      pid,
      status: "beta",
      matterMode: mode,
      hardware: {
        ...foundationPidBlueprint.hardware,
        hasMatter: true,
        hasThread: true
      },
      firmware: {
        ...foundationPidBlueprint.firmware,
        stableVersion: "1.0.0"
      },
      matter: {
        ...foundationPidBlueprint.matter,
        enabled: true,
        mode,
        bridgeSupported: mode !== "NATIVE_MATTER",
        deviceType: mode === "MATTER_BRIDGE_CHILD" ? "water-sensor" : "bridge",
        clusters: ["descriptor", "basic-information"],
        vendorId: "0xFFF1",
        productId: "0x0001",
        discriminator: "3840",
        certificationStatus: "testing"
      }
    });
}

async function registerMatterDevice(pid: string, deviceId = "JNX-TG-MTR-1") {
  await request(createApp())
    .post("/api/v1/devices/register")
    .send({
      deviceId,
      pid,
      homeId: ownerHeaders["x-home-id"],
      ownerUserId: ownerHeaders["x-user-id"],
      displayName: "Matter Device",
      matterEnabled: true
    });
}

describe("matter routes", () => {
  beforeEach(() => {
    delete process.env.MATTER_RUNTIME_ENABLED;
    pidTesting.reset();
    deviceTesting.reset();
    matterTesting.reset();
  });

  afterEach(() => {
    if (originalMatterRuntimeEnabled === undefined) {
      delete process.env.MATTER_RUNTIME_ENABLED;
      return;
    }

    process.env.MATTER_RUNTIME_ENABLED = originalMatterRuntimeEnabled;
  });

  it("returns a Matter readiness status derived from the PID mapping", async () => {
    await createMatterPid("JNX-TG-C3-301", "NATIVE_MATTER");
    await registerMatterDevice("JNX-TG-C3-301");

    const response = await request(createApp())
      .get("/api/v1/matter/devices/JNX-TG-MTR-1/status")
      .set(ownerHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data.mode).toBe("NATIVE_MATTER");
    expect(response.body.data.readiness).toBe("ready_to_commission");
    expect(response.body.data.activationEnabled).toBe(false);
    expect(response.body.data.mapping.vendorId).toBe("0xFFF1");
  });

  it("blocks Matter commissioning until the runtime activation flag is enabled", async () => {
    await createMatterPid("JNX-TG-C3-302", "NATIVE_MATTER");
    await registerMatterDevice("JNX-TG-C3-302");

    const response = await request(createApp())
      .post("/api/v1/matter/devices/JNX-TG-MTR-1/commission")
      .set(ownerHeaders)
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("MQTT/VPS layer only");
  });

  it("stages placeholder Matter commissioning for owner/admin access when activation is enabled", async () => {
    process.env.MATTER_RUNTIME_ENABLED = "true";
    await createMatterPid("JNX-TG-C3-302", "NATIVE_MATTER");
    await registerMatterDevice("JNX-TG-C3-302");

    const response = await request(createApp())
      .post("/api/v1/matter/devices/JNX-TG-MTR-1/commission")
      .set(ownerHeaders)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.action).toBe("commission");
    expect(response.body.data.placeholder).toBe(true);

    const statusResponse = await request(createApp())
      .get("/api/v1/matter/devices/JNX-TG-MTR-1/status")
      .set(ownerHeaders);

    expect(statusResponse.body.data.commissioningState).toBe("requested");
    expect(statusResponse.body.data.lastCommissioningAttemptAt).toBeTruthy();
  });

  it("blocks Matter commissioning for shared member access", async () => {
    process.env.MATTER_RUNTIME_ENABLED = "true";
    await createMatterPid("JNX-TG-C3-303", "NATIVE_MATTER");
    await registerMatterDevice("JNX-TG-C3-303");

    const response = await request(createApp())
      .post("/api/v1/matter/devices/JNX-TG-MTR-1/commission")
      .set({
        "x-user-id": ownerHeaders["x-user-id"],
        "x-home-id": ownerHeaders["x-home-id"],
        "x-home-role": "member"
      })
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("owner/admin");
  });

  it("stages placeholder bridge sync for bridge-mode devices", async () => {
    process.env.MATTER_RUNTIME_ENABLED = "true";
    await createMatterPid("JNX-TG-C3-304", "MATTER_BRIDGE_GATEWAY");
    await registerMatterDevice("JNX-TG-C3-304");

    const response = await request(createApp())
      .post("/api/v1/matter/devices/JNX-TG-MTR-1/bridge-sync")
      .set(ownerHeaders)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.action).toBe("bridge_sync");

    const statusResponse = await request(createApp())
      .get("/api/v1/matter/devices/JNX-TG-MTR-1/status")
      .set(ownerHeaders);

    expect(statusResponse.body.data.bridgeState).toBe("sync_requested");
    expect(statusResponse.body.data.readiness).toBe("bridge_ready");
  });
});
