import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { dashboardApiTesting } from "../dashboard/services/dashboardApi";
import { HomeDashboardPage } from "./HomeDashboardPage";

const session: AuthSession = {
  user: {
    userId: "user-home",
    name: "Home User",
    email: "home-user@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-main",
      name: "Main HOME",
      ownerUserId: "user-home",
      role: "owner",
      isDefault: true,
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-main",
  tokens: {
    accessToken: "home-access",
    refreshToken: "home-refresh",
    expiresInSeconds: 900
  }
};

function DeviceRouteProbe() {
  const { deviceId } = useParams();
  return <div>Device route: {deviceId}</div>;
}

describe("HomeDashboardPage", () => {
  beforeEach(() => {
    dashboardApiTesting.resetDemoStore();
  });

  it("opens the device detail route directly from a home tile tap", async () => {
    dashboardApiTesting.seedDemoDevices(session.user.userId, "home-main", [
      dashboardApiTesting.createDemoDevice({
        deviceId: "JNX-TG-HOME01",
        homeId: "home-main",
        ownerUserId: session.user.userId,
        displayName: "Roof Tank"
      })
    ]);

    render(
      <MemoryRouter initialEntries={["/home"]}>
        <AuthSessionProvider initialSession={session}>
          <Routes>
            <Route path="/home" element={<HomeDashboardPage />} />
            <Route path="/devices/:deviceId" element={<DeviceRouteProbe />} />
          </Routes>
        </AuthSessionProvider>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("Roof Tank"));
    expect(await screen.findByText("Device route: JNX-TG-HOME01")).toBeInTheDocument();
  });
});
