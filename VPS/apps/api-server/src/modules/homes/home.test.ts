import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { homeTesting } from "./home.service";

const ownerHeaders = {
  "x-user-id": "user-owner-1",
  "x-user-name": "Owner One",
  "x-user-email": "owner1@example.com"
};

const invitedUserHeaders = {
  "x-user-id": "user-member-1",
  "x-user-name": "Member One",
  "x-user-email": "member1@example.com"
};

describe("home routes", () => {
  beforeEach(() => {
    homeTesting.reset();
  });

  it("lists the default HOME for the current user", async () => {
    const response = await request(createApp())
      .get("/api/v1/homes")
      .set(ownerHeaders);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe("HOME");
    expect(response.body.data[0].role).toBe("owner");
  });

  it("creates a share code, redeems it, and returns the shared HOME", async () => {
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(ownerHeaders);
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(ownerHeaders)
      .send({
        role: "member",
        expiresInHours: 24
      });

    expect(shareCodeResponse.status).toBe(201);
    expect(shareCodeResponse.body.data.role).toBe("member");

    const redeemResponse = await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(invitedUserHeaders)
      .send({
        code: shareCodeResponse.body.data.code
      });

    expect(redeemResponse.status).toBe(200);
    expect(redeemResponse.body.data.home.homeId).toBe(homeId);
    expect(redeemResponse.body.data.home.role).toBe("member");
    expect(redeemResponse.body.data.homes).toHaveLength(2);
  });

  it("lets the owner update and revoke a shared member", async () => {
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(ownerHeaders);
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(ownerHeaders)
      .send({
        role: "member"
      });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(invitedUserHeaders)
      .send({
        code: shareCodeResponse.body.data.code
      });

    const promoteResponse = await request(createApp())
      .patch(`/api/v1/homes/${encodeURIComponent(homeId)}/members/user-member-1`)
      .set(ownerHeaders)
      .send({
        role: "admin"
      });

    expect(promoteResponse.status).toBe(200);
    expect(promoteResponse.body.data[1].role).toBe("admin");

    const revokeResponse = await request(createApp())
      .delete(`/api/v1/homes/${encodeURIComponent(homeId)}/members/user-member-1`)
      .set(ownerHeaders);

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.data).toHaveLength(1);
    expect(revokeResponse.body.data[0].userId).toBe("user-owner-1");
  });

  it("blocks non-admin users from creating share codes", async () => {
    const homesResponse = await request(createApp())
      .get("/api/v1/homes")
      .set(ownerHeaders);
    const homeId = homesResponse.body.data[0].homeId as string;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(ownerHeaders)
      .send({
        role: "viewer"
      });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(invitedUserHeaders)
      .send({
        code: shareCodeResponse.body.data.code
      });

    const blockedResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(invitedUserHeaders)
      .send({
        role: "member"
      });

    expect(blockedResponse.status).toBe(403);
    expect(blockedResponse.body.error).toContain("owner/admin");
  });
});
