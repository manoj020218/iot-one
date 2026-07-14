import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AuthSession } from "@jenix/shared";
import { afterEach, describe, expect, it } from "vitest";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AppRouter } from "../../app/AppRouter";

const session: AuthSession = {
  user: {
    userId: "user-profile",
    name: "Profile User",
    email: "profile@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-profile",
      name: "Profile Home",
      ownerUserId: "user-profile",
      role: "owner",
      isDefault: true,
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-profile",
  tokens: {
    accessToken: "profile-access",
    refreshToken: "profile-refresh",
    expiresInSeconds: 900
  }
};

describe("UserProfilePage", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows logout and returns the user to login", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/profile"]}>
        <AuthSessionProvider initialSession={session}>
          <AppRouter />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    const logoutButton = await screen.findByRole("button", { name: "Logout" });
    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);

    expect(await screen.findByText("Continue with Google")).toBeInTheDocument();
  });
});
