import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app";

describe("auth routes", () => {
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
    expect(response.body.data.tokens.accessToken).toBe("access-user-asha-example-com");
  });

  it("supports email login and keeps the token contract stable", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/email/login")
      .send({
        email: "operator@example.com",
        password: "Password123!"
      });

    expect(response.status).toBe(200);
    expect(response.body.data.user.provider).toBe("email");
    expect(response.body.data.tokens.refreshToken).toBe(
      "refresh-user-operator-example-com"
    );
  });
});
