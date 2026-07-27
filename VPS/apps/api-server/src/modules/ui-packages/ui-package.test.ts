import { foundationPidBlueprint } from "@jenix/device-schemas";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app";
import { pidTesting } from "../pid/pid.service";

import { resolveUiPackageArtifact, uiPackageTesting } from "./ui-package.service";

const developerHeaders = {
  "x-role": "JENIX_DEVELOPER",
  "x-actor-id": "dev-registry"
};

function buildPidPayload(pid: string) {
  return {
    ...foundationPidBlueprint,
    pid,
    status: "beta",
    firmware: {
      ...foundationPidBlueprint.firmware,
      stableVersion: "1.0.0"
    }
  };
}

async function createPid(app: ReturnType<typeof createApp>, pid: string) {
  await request(app)
    .post("/api/v1/admin/pids")
    .set(developerHeaders)
    .send(buildPidPayload(pid));
}

describe("ui package registry routes", () => {
  beforeEach(async () => {
    await Promise.all([pidTesting.reset(), uiPackageTesting.reset()]);
  });

  it("registers a package bound to an existing PID", async () => {
    const app = createApp();
    await createPid(app, "JNX-P10-C3-201");

    const response = await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send({
        packageId: "p10-token-display",
        pid: "JNX-P10-C3-201",
        displayName: "P10 LED Token Display remote UI",
        version: "0.1.0",
        manifestPath: "/ui-packages/p10-token-display/0.1.0/manifest.json",
        entryPath: "/ui-packages/p10-token-display/0.1.0/remoteEntry.js",
        exportName: "P10TokenDisplayDynamicPage"
      });

    expect(response.status).toBe(201);
    expect(response.body.data.packageId).toBe("p10-token-display");
    expect(response.body.data.versions).toHaveLength(1);
    expect(response.body.data.versions[0].status).toBe("draft");
  });

  it("rejects registering a package against a PID that does not exist", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send({
        packageId: "ghost-package",
        pid: "JNX-GHOST-001",
        displayName: "Ghost",
        version: "0.1.0",
        manifestPath: "/ui-packages/ghost/0.1.0/manifest.json",
        entryPath: "/ui-packages/ghost/0.1.0/remoteEntry.js",
        exportName: "GhostDynamicPage"
      });

    expect(response.status).toBe(404);
  });

  it("rejects a duplicate packageId", async () => {
    const app = createApp();
    await createPid(app, "JNX-P10-C3-202");
    const payload = {
      packageId: "p10-token-display-dup",
      pid: "JNX-P10-C3-202",
      displayName: "Dup",
      version: "0.1.0",
      manifestPath: "/ui-packages/dup/0.1.0/manifest.json",
      entryPath: "/ui-packages/dup/0.1.0/remoteEntry.js",
      exportName: "DupDynamicPage"
    };

    await request(app).post("/api/v1/admin/ui-packages").set(developerHeaders).send(payload);
    const response = await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send(payload);

    expect(response.status).toBe(409);
  });

  it("adds, publishes, and rolls back package versions", async () => {
    const app = createApp();
    await createPid(app, "JNX-P10-C3-203");
    await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send({
        packageId: "p10-token-display-lifecycle",
        pid: "JNX-P10-C3-203",
        displayName: "P10 lifecycle",
        version: "1.0.0",
        manifestPath: "/ui-packages/p10/1.0.0/manifest.json",
        entryPath: "/ui-packages/p10/1.0.0/remoteEntry.js",
        exportName: "P10DynamicPage",
        publishImmediately: true
      });

    // A resolvable, published version is exactly what HOME bootstrap needs.
    await expect(
      resolveUiPackageArtifact("p10-token-display-lifecycle", "1.0.0")
    ).resolves.toMatchObject({ version: "1.0.0" });

    await request(app)
      .post("/api/v1/admin/ui-packages/p10-token-display-lifecycle/versions")
      .set(developerHeaders)
      .send({
        version: "1.1.0",
        manifestPath: "/ui-packages/p10/1.1.0/manifest.json",
        entryPath: "/ui-packages/p10/1.1.0/remoteEntry.js",
        exportName: "P10DynamicPage",
        publishImmediately: true
      });

    const afterPublish = await request(app)
      .get("/api/v1/admin/ui-packages/p10-token-display-lifecycle")
      .set(developerHeaders);

    const statusByVersion = Object.fromEntries(
      afterPublish.body.data.versions.map((entry: { version: string; status: string }) => [
        entry.version,
        entry.status
      ])
    );
    expect(statusByVersion["1.1.0"]).toBe("published");
    expect(statusByVersion["1.0.0"]).toBe("deprecated");

    // 1.0.0 no longer resolves for new bootstraps once deprecated... actually
    // deprecated versions still resolve (in-flight devices can keep loading
    // them) — only draft versions are excluded.
    await expect(
      resolveUiPackageArtifact("p10-token-display-lifecycle", "1.0.0")
    ).resolves.toMatchObject({ version: "1.0.0" });

    const rollback = await request(app)
      .post("/api/v1/admin/ui-packages/p10-token-display-lifecycle/rollback")
      .set(developerHeaders)
      .send({ version: "1.0.0" });

    expect(rollback.status).toBe(200);
    const rolledBackStatus = Object.fromEntries(
      rollback.body.data.versions.map((entry: { version: string; status: string }) => [
        entry.version,
        entry.status
      ])
    );
    expect(rolledBackStatus["1.0.0"]).toBe("published");
    expect(rolledBackStatus["1.1.0"]).toBe("deprecated");
  });

  it("rejects rollback to a version that was never published", async () => {
    const app = createApp();
    await createPid(app, "JNX-P10-C3-204");
    await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send({
        packageId: "p10-token-display-draft-only",
        pid: "JNX-P10-C3-204",
        displayName: "Draft only",
        version: "0.1.0",
        manifestPath: "/ui-packages/p10/0.1.0/manifest.json",
        entryPath: "/ui-packages/p10/0.1.0/remoteEntry.js",
        exportName: "P10DynamicPage"
      });

    const response = await request(app)
      .post("/api/v1/admin/ui-packages/p10-token-display-draft-only/rollback")
      .set(developerHeaders)
      .send({ version: "0.1.0" });

    expect(response.status).toBe(409);
  });

  it("resolves the seeded tank-guard-mobile package for HOME bootstrap", async () => {
    await expect(
      resolveUiPackageArtifact("tank-guard-mobile", "1.0.0")
    ).resolves.toMatchObject({
      packageId: "tank-guard-mobile",
      exportName: "TankGuardDynamicPage"
    });
  });

  it("returns undefined for a draft version — draft packages never serve devices", async () => {
    const app = createApp();
    await createPid(app, "JNX-P10-C3-205");
    await request(app)
      .post("/api/v1/admin/ui-packages")
      .set(developerHeaders)
      .send({
        packageId: "p10-token-display-still-draft",
        pid: "JNX-P10-C3-205",
        displayName: "Still draft",
        version: "0.1.0",
        manifestPath: "/ui-packages/p10/0.1.0/manifest.json",
        entryPath: "/ui-packages/p10/0.1.0/remoteEntry.js",
        exportName: "P10DynamicPage"
      });

    await expect(
      resolveUiPackageArtifact("p10-token-display-still-draft", "0.1.0")
    ).resolves.toBeUndefined();
  });
});
