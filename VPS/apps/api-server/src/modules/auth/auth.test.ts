import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "./auth.service";
import { homeTesting } from "../homes/home.service";

describe("auth routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
  });

  it("creates a default HOME during email signup", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/email/signup")
      .send({
        name: "Asha",
        email: "asha@example.com",
        password: "Password123!"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe("asha@example.com");
    expect(response.body.data.homes[0].name).toBe("HOME");
    expect(response.body.data.homes[0].role).toBe("owner");
    expect(response.body.data.activeHomeId).toBe("home-user-asha-example-com");
    expect(response.body.data.tokens.accessToken).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
  });

  it("supports email login and keeps the token contract stable", async () => {
    await request(createApp())
      .post("/api/v1/auth/email/signup")
      .send({
        name: "Operator",
        email: "operator@example.com",
        password: "Password123!"
      });

    const response = await request(createApp())
      .post("/api/v1/auth/email/login")
      .send({
        email: "operator@example.com",
        password: "Password123!"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.provider).toBe("email");
    expect(response.body.data.tokens.refreshToken).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
  });
});
