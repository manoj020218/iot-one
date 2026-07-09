import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { deviceTesting } from "../devices/device.service";
import { homeTesting } from "./home.service";
import { pidTesting } from "../pid/pid.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { foundationPidBlueprint } from "@jenix/device-schemas";

describe("home routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await deviceTesting.reset();
    await pidTesting.reset();
  });

  it("lists the default HOME for the current user", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Owner One",
      email: "owner1@example.com"
    });
    const response = await request(createApp())
      .get("/api/v1/homes")
      .set(createAuthHeaders(ownerSession));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("HOME");
    expect(response.body.data[0].role).toBe("owner");
  });

  it("creates a share code, redeems it, and returns the shared HOME", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Owner One",
      email: "owner1@example.com"
    });
    const invitedSession = await createAuthenticatedSession({
      name: "Member One",
      email: "member1@example.com"
    });
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(createAuthHeaders(ownerSession));
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(ownerSession))
      .send({
        role: "member",
        expiresInHours: 24
      });

    expect(shareCodeResponse.status).toBe(201);
    expect(shareCodeResponse.body.data.role).toBe("member");

    const redeemResponse = await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(invitedSession))
      .send({
        code: shareCodeResponse.body.data.code
      });

    expect(redeemResponse.status).toBe(200);
    expect(redeemResponse.body.data.home.homeId).toBe(homeId);
    expect(redeemResponse.body.data.home.role).toBe("member");
    expect(redeemResponse.body.data.homes).toHaveLength(2);
  });

  it("lets the owner update and revoke a shared member", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Owner One",
      email: "owner1@example.com"
    });
    const invitedSession = await createAuthenticatedSession({
      name: "Member One",
      email: "member1@example.com"
    });
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(createAuthHeaders(ownerSession));
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(ownerSession))
      .send({
        role: "member"
      });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(invitedSession))
      .send({
        code: shareCodeResponse.body.data.code
      });

    const promoteResponse = await request(createApp())
      .patch(
        `/api/v1/homes/${encodeURIComponent(homeId)}/members/${encodeURIComponent(invitedSession.user.userId)}`
      )
      .set(createAuthHeaders(ownerSession))
      .send({
        role: "admin"
      });

    expect(promoteResponse.status).toBe(200);
    expect(promoteResponse.body.data[1].role).toBe("admin");

    const revokeResponse = await request(createApp())
      .delete(
        `/api/v1/homes/${encodeURIComponent(homeId)}/members/${encodeURIComponent(invitedSession.user.userId)}`
      )
      .set(createAuthHeaders(ownerSession));

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.data).toHaveLength(1);
    expect(revokeResponse.body.data[0].userId).toBe(ownerSession.user.userId);
  });

  it("blocks non-admin users from creating share codes", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Owner One",
      email: "owner1@example.com"
    });
    const invitedSession = await createAuthenticatedSession({
      name: "Member One",
      email: "member1@example.com"
    });
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(createAuthHeaders(ownerSession));
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(ownerSession))
      .send({
        role: "viewer"
      });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(invitedSession))
      .send({
        code: shareCodeResponse.body.data.code
      });

    const blockedResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(invitedSession))
      .send({
        role: "member"
      });

    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.error).toContain("owner/admin");
  });

  it("returns a deduped UI bootstrap for a HOME", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Owner One",
      email: "owner1@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    await request(createApp())
      .post("/api/v1/admin/pids")
      .set({
        "x-role": "JENIX_DEVELOPER",
        "x-actor-id": "home-ui-bootstrap-test"
      })
      .send({
        ...foundationPidBlueprint,
        pid: "JNX-TG-C3-901",
        status: "beta",
        firmware: {
          ...foundationPidBlueprint.firmware,
          stableVersion: "1.0.0"
        }
      });

    await request(createApp()).post("/api/v1/devices/register").send({
      deviceId: "jnx-tg-uib-1",
      pid: "JNX-TG-C3-901",
      homeId,
      ownerUserId: ownerSession.user.userId
    });

    const response = await request(createApp())
      .get(`/api/v1/homes/${encodeURIComponent(homeId)}/ui-bootstrap`)
      .set(createAuthHeaders(ownerSession, { homeId }));

    expect(response.status).toBe(200);
    expect(response.body.data.homeId).toBe(homeId);
    expect(response.body.data.devices).toHaveLength(1);
    expect(response.body.data.pidBindings[0].uiPackageId).toBe("tank-guard-mobile");
    expect(response.body.data.packages[0].packageId).toBe("tank-guard-mobile");
  });
});
