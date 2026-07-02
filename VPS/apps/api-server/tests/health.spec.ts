import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("GET /api/v1/health", () => {
  it("returns the workspace health payload", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: {
        service: "api-server",
        project: "Jenix IoT Platform",
        apiPrefix: "/api/v1",
        status: "ok"
      }
    });
  });
});
