import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { pidTesting } from "./pid.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "dev-phase-3"
};

function buildPidPayload(pid: string, status: "draft" | "beta" = "draft") {
  return {
    ...foundationPidBlueprint,
    pid,
    status,
    firmware: {
      ...foundationPidBlueprint.firmware,
      stableVersion: "1.0.0"
    }
  };
}

describe("pid routes", () => {
  beforeEach(() => {
    pidTesting.reset();
  });

  it("creates a PID record through the admin route", async () => {
    const response = await request(createApp())
      .post("/api/v1/admin/pids")
      .set(developerHeaders)
      .send(buildPidPayload("JNX-TG-C3-101"));

    expect(response.status).toBe(201);
    expect(response.body.data.pid).toBe("JNX-TG-C3-101");
    expect(response.body.data.createdBy).toBe("dev-phase-3");
    expect(response.body.data.status).toBe("draft");
  });

  it("approves a PID and promotes it to production", async () => {
    await request(createApp())
      .post("/api/v1/admin/pids")
      .set(developerHeaders)
      .send(buildPidPayload("JNX-TG-C3-102", "beta"));

    const response = await request(createApp())
      .post("/api/v1/admin/pids/JNX-TG-C3-102/approve")
      .set(developerHeaders)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("production");
    expect(response.body.data.approvedBy).toBe("dev-phase-3");
    expect(response.body.data.approvedAt).toBeTruthy();
  });

  it("rejects PID mutation after production approval", async () => {
    await request(createApp())
      .post("/api/v1/admin/pids")
      .set(developerHeaders)
      .send(buildPidPayload("JNX-TG-C3-103", "beta"));

    await request(createApp())
      .post("/api/v1/admin/pids/JNX-TG-C3-103/approve")
      .set(developerHeaders)
      .send();

    const response = await request(createApp())
      .patch("/api/v1/admin/pids/JNX-TG-C3-103")
      .set(developerHeaders)
      .send({
        productName: "Updated Tank Guard"
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/immutable/i);
  });

  it("returns public PID metadata without developer headers", async () => {
    await request(createApp())
      .post("/api/v1/admin/pids")
      .set(developerHeaders)
      .send(buildPidPayload("JNX-TG-C3-104", "beta"));

    const response = await request(createApp()).get("/api/v1/pids/JNX-TG-C3-104");

    expect(response.status).toBe(200);
    expect(response.body.data.pid).toBe("JNX-TG-C3-104");
    expect(response.body.data.createdBy).toBeUndefined();
    expect(response.body.data.dashboard.templateId).toBe("tank-guard-default");
  });
});
