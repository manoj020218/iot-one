import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AppRouter } from "../../app/AppRouter";

const session: AuthSession = {
  user: {
    userId: "user-settings",
    name: "Settings User",
    email: "settings@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-settings",
      name: "Settings Home",
      ownerUserId: "user-settings",
      role: "owner",
      isDefault: true,
      timezone: "Asia/Kolkata",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-settings",
  tokens: {
    accessToken: "settings-access",
    refreshToken: "settings-refresh",
    expiresInSeconds: 900
  }
};

describe("SettingsHomePage", () => {
  it("renders the shared bottom navigation and home management cards", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AuthSessionProvider initialSession={session}>
          <AppRouter />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Home Management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scenes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });
});
