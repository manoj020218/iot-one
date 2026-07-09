import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { foundationPidBlueprint } from "@jenix/device-schemas";
import {
  createUiPackageKey,
  createDeviceRecord,
  type AuthSession,
  type HomeRecord
} from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { DeviceDetailPage } from "./DeviceDetailPage";
import { devicePackageRegistryTesting } from "./plugins/devicePackageRegistry";
import { TankGuardDynamicPage } from "./plugins/tank-guard-mobile/v1.0.0/TankGuardDynamicPage";
import { deviceManagementApiTesting } from "./services/deviceManagementApi";
import { devicePluginRuntimeApiTesting } from "./services/devicePluginRuntimeApi";
import { uiBootstrapApiTesting } from "./services/uiBootstrapApi";

const ownerHome: HomeRecord = {
  homeId: "home-owner",
  name: "Owner HOME",
  ownerUserId: "user-owner",
  role: "owner",
  isDefault: true,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z"
};

const viewerHome: HomeRecord = {
  homeId: "home-viewer",
  name: "Viewer HOME",
  ownerUserId: "user-owner",
  role: "viewer",
  isDefault: false,
  createdAt: "2026-07-02T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z"
};

const ownerSession: AuthSession = {
  user: {
    userId: "user-owner",
    name: "Owner",
    email: "owner@example.com",
    provider: "email"
  },
  homes: [ownerHome],
  activeHomeId: ownerHome.homeId,
  tokens: {
    accessToken: "owner-access",
    refreshToken: "owner-refresh",
    expiresInSeconds: 900
  }
};

const viewerSession: AuthSession = {
  user: {
    userId: "user-viewer",
    name: "Viewer",
    email: "viewer@example.com",
    provider: "email"
  },
  homes: [viewerHome],
  activeHomeId: viewerHome.homeId,
  tokens: {
    accessToken: "viewer-access",
    refreshToken: "viewer-refresh",
    expiresInSeconds: 900
  }
};

function renderDeviceRoute(session: AuthSession) {
  render(
    <MemoryRouter
      initialEntries={["/devices/JNX-TG-A7F9"]}
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
    >
      <AuthSessionProvider initialSession={session}>
        <Routes>
          <Route path="/devices/:deviceId" element={<DeviceDetailPage />} />
        </Routes>
      </AuthSessionProvider>
    </MemoryRouter>
  );
}

describe("DeviceDetailPage", () => {
  beforeEach(() => {
    cleanup();
    deviceManagementApiTesting.reset();
    devicePackageRegistryTesting.reset();
    devicePluginRuntimeApiTesting.reset();
    uiBootstrapApiTesting.reset();
  });

  it("renders a fallback panel for unsupported PID dynamic pages", async () => {
    deviceManagementApiTesting.seedDemoDevices(ownerSession.user.userId, ownerHome.homeId, [
      createDeviceRecord({
        deviceId: "JNX-TG-A7F9",
        pid: "JNX-TG-C3-901",
        homeId: ownerHome.homeId,
        ownerUserId: ownerSession.user.userId,
        displayName: "Roof Tank",
        firmwareVersion: "0.9.0"
      })
    ]);
    deviceManagementApiTesting.seedPidProfile({
      ...foundationPidBlueprint,
      pid: "JNX-TG-C3-901",
      productName: "Tank Guard Plus",
      dashboard: {
        ...foundationPidBlueprint.dashboard,
        dynamicPages: ["tank-level", "custom-water-math"]
      }
    });

    renderDeviceRoute(ownerSession);

    expect(await screen.findByText("Unsupported Dynamic Page")).toBeInTheDocument();
    expect(screen.getByText(/custom-water-math/)).toBeInTheDocument();
  });

  it("renders the Tank Guard package through the HOME bootstrap mapping", async () => {
    const pid = "JNX-TG-C3-903";
    const packageKey = createUiPackageKey("tank-guard-mobile", "1.0.0");

    deviceManagementApiTesting.seedDemoDevices(ownerSession.user.userId, ownerHome.homeId, [
      createDeviceRecord({
        deviceId: "JNX-TG-A7F9",
        pid,
        homeId: ownerHome.homeId,
        ownerUserId: ownerSession.user.userId,
        displayName: "Roof Tank",
        firmwareVersion: "1.0.3"
      })
    ]);
    deviceManagementApiTesting.seedPidProfile({
      ...foundationPidBlueprint,
      pid,
      productName: "Smart Tank Guard",
      ui: {
        uiMode: "remote-package",
        uiPackageId: "tank-guard-mobile",
        uiPackageVersion: "1.0.0"
      },
      dashboard: {
        ...foundationPidBlueprint.dashboard,
        templateId: "tank-guard-mobile-v1",
        dynamicPages: ["tank-guard-mobile"]
      }
    });
    devicePackageRegistryTesting.seedPackage("tank-guard-mobile", "1.0.0", {
      TankGuardDynamicPage
    });
    uiBootstrapApiTesting.seedBootstrap(ownerHome.homeId, {
      homeId: ownerHome.homeId,
      generatedAt: "2026-07-09T11:40:00.000Z",
      devices: [
        {
          deviceId: "JNX-TG-A7F9",
          pid,
          displayName: "Roof Tank",
          homeId: ownerHome.homeId,
          online: true,
          templateId: "tank-guard-mobile-v1",
          dynamicPages: ["tank-guard-mobile"],
          uiMode: "remote-package",
          uiPackageId: "tank-guard-mobile",
          uiPackageVersion: "1.0.0",
          packageKey
        }
      ],
      pidBindings: [
        {
          pid,
          productName: "Smart Tank Guard",
          templateId: "tank-guard-mobile-v1",
          dynamicPages: ["tank-guard-mobile"],
          uiMode: "remote-package",
          uiPackageId: "tank-guard-mobile",
          uiPackageVersion: "1.0.0",
          packageKey
        }
      ],
      packages: [
        {
          packageId: "tank-guard-mobile",
          version: "1.0.0",
          manifestPath: "/ui-packages/tank-guard-mobile/1.0.0/manifest.json",
          entryPath: "/ui-packages/tank-guard-mobile/1.0.0/remoteEntry.js",
          exportName: "TankGuardDynamicPage"
        }
      ]
    });
    devicePluginRuntimeApiTesting.seedRuntime({
      deviceId: "JNX-TG-A7F9",
      pid,
      telemetrySnapshot: {
        deviceId: "JNX-TG-A7F9",
        pid,
        occurredAt: "2026-07-09T11:41:00.000Z",
        telemetry: {
          tankLevelPct: 72,
          tankLevelMm: 740,
          zeroLevelMm: 12,
          wifiRssi: -61,
          wifiSsidName: "JenixLab",
          localIp: "192.168.1.88",
          localUrl: "http://tankguard.local",
          wifiTxPowerDbm: 8.5,
          pumpRunning: true,
          alarmState: "normal",
          sensorStatus: "ready"
        },
        history: [61, 66, 72]
      },
      settings: {
        config: {
          capacityLitres: 2000,
          wifiTxPowerDbm: 8.5,
          zeroLevelMm: 12,
          bottomMotorStartLevelMm: 300,
          topMotorOffLevelMm: 900,
          overflowMarginMm: 30
        }
      }
    });

    renderDeviceRoute(ownerSession);

    expect(await screen.findByText("Zero and Capacity Controls")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roof Tank", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("JenixLab")).toBeInTheDocument();
  });

  it("blocks firmware requests for a viewer home role", async () => {
    deviceManagementApiTesting.seedDemoDevices(
      viewerSession.user.userId,
      viewerHome.homeId,
      [
        createDeviceRecord({
          deviceId: "JNX-TG-A7F9",
          pid: foundationPidBlueprint.pid,
          homeId: viewerHome.homeId,
          ownerUserId: "user-owner",
          displayName: "Shared Tank",
          firmwareVersion: "0.9.0"
        })
      ]
    );

    renderDeviceRoute(viewerSession);

    expect(
      await screen.findByText("Viewer access cannot request firmware updates.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request Firmware Update" })
    ).toBeDisabled();
  });

  it("renders Matter readiness for a Matter-capable PID", async () => {
    deviceManagementApiTesting.seedDemoDevices(ownerSession.user.userId, ownerHome.homeId, [
      createDeviceRecord({
        deviceId: "JNX-TG-A7F9",
        pid: "JNX-TG-C3-902",
        homeId: ownerHome.homeId,
        ownerUserId: ownerSession.user.userId,
        displayName: "Matter Tank",
        firmwareVersion: "1.0.0",
        matterEnabled: true
      })
    ]);
    deviceManagementApiTesting.seedPidProfile({
      ...foundationPidBlueprint,
      pid: "JNX-TG-C3-902",
      productName: "Matter Tank Guard",
      matterMode: "NATIVE_MATTER",
      hardware: {
        ...foundationPidBlueprint.hardware,
        hasMatter: true,
        hasThread: true
      },
      matter: {
        ...foundationPidBlueprint.matter,
        enabled: true,
        mode: "NATIVE_MATTER",
        deviceType: "water-valve",
        clusters: ["descriptor", "identify"],
        vendorId: "0xFFF1",
        productId: "0x0102",
        certificationStatus: "testing"
      }
    });

    renderDeviceRoute(ownerSession);

    expect(await screen.findByText("Matter Readiness")).toBeInTheDocument();
    expect(screen.getByText("ready to commission")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(
      screen.getByText(/Matter remains planned at the MQTT\/VPS layer only/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Matter Commissioning" })
    ).toBeDisabled();
  });

  it("renders firmware rollout history including replay affordance for failed jobs", async () => {
    deviceManagementApiTesting.seedDemoDevices(ownerSession.user.userId, ownerHome.homeId, [
      createDeviceRecord({
        deviceId: "JNX-TG-A7F9",
        pid: foundationPidBlueprint.pid,
        homeId: ownerHome.homeId,
        ownerUserId: ownerSession.user.userId,
        displayName: "Replay Tank",
        firmwareVersion: "0.9.0"
      })
    ]);
    deviceManagementApiTesting.seedDemoRollouts("JNX-TG-A7F9", [
      {
        requestId: "ota-local-failed",
        deviceId: "JNX-TG-A7F9",
        homeId: ownerHome.homeId,
        pid: foundationPidBlueprint.pid,
        channel: "stable",
        targetVersion: "1.0.0",
        artifactUrl: "demo://ota/1.0.0",
        checksum: "demo-checksum-1.0.0",
        requestedAt: "2026-07-03T14:00:00.000Z",
        requestedBy: ownerSession.user.userId,
        currentVersion: "0.9.0",
        attemptCount: 1,
        status: "failed",
        failedAt: "2026-07-03T14:01:00.000Z",
        lastError: "Checksum mismatch"
      }
    ]);

    renderDeviceRoute(ownerSession);

    expect(await screen.findByText("Firmware Rollout History")).toBeInTheDocument();
    expect(screen.getByText(/ota-local-failed/)).toBeInTheDocument();
    expect(screen.getByText("Checksum mismatch")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replay Failed Rollout" })
    ).toBeInTheDocument();
  });
});
