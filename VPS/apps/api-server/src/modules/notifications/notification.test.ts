import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { authTesting } from "../auth/auth.service";
import { homeTesting } from "../homes/home.service";
import { createSceneActionDispatchWorker } from "../scenes/scene.action-worker";
import { sceneTesting } from "../scenes/scene.service";
import { createAuthenticatedSession, createAuthHeaders } from "../../test-support/auth";
import { createNotification } from "./notification.write";
import { notificationTesting } from "./notification.service";

describe("notification routes", () => {
  beforeEach(async () => {
    await authTesting.reset();
    await homeTesting.reset();
    await sceneTesting.reset();
    await notificationTesting.reset();
  });

  it("lists, marks read, and deletes notifications for the current HOME", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Notify Owner",
      email: "notify-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    const notification = await createNotification({
      homeId,
      category: "system",
      severity: "info",
      title: "Welcome",
      body: "Your HOME is ready.",
      sourceType: "system"
    });

    const listResponse = await request(createApp())
      .get("/api/v1/notifications")
      .set(createAuthHeaders(ownerSession));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].notificationId).toBe(notification.notificationId);
    expect(listResponse.body.data[0].readAt).toBeUndefined();

    const readResponse = await request(createApp())
      .patch(`/api/v1/notifications/${notification.notificationId}/read`)
      .set(createAuthHeaders(ownerSession));

    expect(readResponse.status).toBe(200);
    expect(readResponse.body.data.readAt).toBeTruthy();

    const deleteResponse = await request(createApp())
      .delete(`/api/v1/notifications/${notification.notificationId}`)
      .set(createAuthHeaders(ownerSession));

    expect(deleteResponse.status).toBe(200);

    const finalListResponse = await request(createApp())
      .get("/api/v1/notifications")
      .set(createAuthHeaders(ownerSession));

    expect(finalListResponse.body.data).toHaveLength(0);
  });

  it("marks all notifications as read in one call", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Notify Bulk Owner",
      email: "notify-bulk-owner@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    await createNotification({
      homeId,
      category: "home",
      severity: "info",
      title: "First",
      body: "First body",
      sourceType: "home"
    });
    await createNotification({
      homeId,
      category: "home",
      severity: "info",
      title: "Second",
      body: "Second body",
      sourceType: "home"
    });

    const markAllResponse = await request(createApp())
      .post("/api/v1/notifications/mark-all-read")
      .set(createAuthHeaders(ownerSession));

    expect(markAllResponse.status).toBe(200);
    expect(markAllResponse.body.data).toHaveLength(2);
    expect(markAllResponse.body.data.every((item: { readAt?: string }) => item.readAt)).toBe(
      true
    );
  });

  it("blocks access to a notification from another HOME", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Notify Owner A",
      email: "notify-owner-a@example.com"
    });
    const otherSession = await createAuthenticatedSession({
      name: "Notify Owner B",
      email: "notify-owner-b@example.com"
    });

    const notification = await createNotification({
      homeId: ownerSession.activeHomeId!,
      category: "system",
      severity: "info",
      title: "Private",
      body: "Only owner A should see this.",
      sourceType: "system"
    });

    const readResponse = await request(createApp())
      .patch(`/api/v1/notifications/${notification.notificationId}/read`)
      .set(createAuthHeaders(otherSession));

    expect(readResponse.status).toBe(403);
  });

  it("creates a notification when a scene notification action dispatches", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Scene Notify Owner",
      email: "scene-notify-owner@example.com"
    });

    const createResponse = await request(createApp())
      .post("/api/v1/scenes")
      .set(createAuthHeaders(ownerSession))
      .send({
        name: "Tank Level Alert",
        status: "active",
        triggers: [{ type: "manual" }],
        conditions: [],
        actions: [
          {
            type: "notification",
            message: "Tank level crossed 80%"
          }
        ]
      });
    const sceneId = createResponse.body.data.sceneId as string;

    await request(createApp())
      .post(`/api/v1/scenes/${sceneId}/run`)
      .set(createAuthHeaders(ownerSession))
      .send({});

    const worker = createSceneActionDispatchWorker({
      workerId: "notification-fanout-worker",
      intervalMs: 1_000,
      batchSize: 10,
      visibilityTimeoutMs: 30_000,
      logger: () => undefined
    });

    await worker.runOnce("2026-07-03T14:00:00.000Z");

    const listResponse = await request(createApp())
      .get("/api/v1/notifications")
      .set(createAuthHeaders(ownerSession));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].category).toBe("alarm");
    expect(listResponse.body.data[0].sourceType).toBe("scene");
    expect(listResponse.body.data[0].sourceId).toBe(sceneId);
    expect(listResponse.body.data[0].title).toBe("Tank Level Alert");
  });

  it("creates a notification when a member joins, leaves, or is managed", async () => {
    const ownerSession = await createAuthenticatedSession({
      name: "Home Notify Owner",
      email: "home-notify-owner@example.com"
    });
    const memberSession = await createAuthenticatedSession({
      name: "Home Notify Member",
      email: "home-notify-member@example.com"
    });
    const homeId = ownerSession.activeHomeId!;

    const shareCodeResponse = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(ownerSession))
      .send({ role: "member" });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(memberSession))
      .send({ code: shareCodeResponse.body.data.code });

    await request(createApp())
      .patch(
        `/api/v1/homes/${encodeURIComponent(homeId)}/members/${encodeURIComponent(memberSession.user.userId)}`
      )
      .set(createAuthHeaders(ownerSession))
      .send({ role: "admin" });

    await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/leave`)
      .set(createAuthHeaders(memberSession, { homeId }));

    const shareCodeResponse2 = await request(createApp())
      .post(`/api/v1/homes/${encodeURIComponent(homeId)}/share-codes`)
      .set(createAuthHeaders(ownerSession))
      .send({ role: "member" });

    await request(createApp())
      .post("/api/v1/homes/redeem")
      .set(createAuthHeaders(memberSession))
      .send({ code: shareCodeResponse2.body.data.code });

    await request(createApp())
      .delete(
        `/api/v1/homes/${encodeURIComponent(homeId)}/members/${encodeURIComponent(memberSession.user.userId)}`
      )
      .set(createAuthHeaders(ownerSession));

    const listResponse = await request(createApp())
      .get("/api/v1/notifications")
      .set(createAuthHeaders(ownerSession));

    expect(listResponse.status).toBe(200);
    const titles = listResponse.body.data.map(
      (item: { title: string }) => item.title
    ) as string[];

    expect(titles).toContain("New member joined");
    expect(titles).toContain("Member role updated");
    expect(titles).toContain("Member left");
    expect(titles).toContain("Member removed");
  });
});
