import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { homeApiTesting } from "../homes/services/homeApi";
import { HomeManagementPage } from "./HomeManagementPage";

const session: AuthSession = {
  user: {
    userId: "user-home-mgmt",
    name: "Home Manager",
    email: "home.manager@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-main",
      name: "My Home",
      ownerUserId: "user-home-mgmt",
      role: "owner",
      isDefault: true,
      timezone: "Asia/Kolkata",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-main",
  tokens: {
    accessToken: "access-home-mgmt",
    refreshToken: "refresh-home-mgmt",
    expiresInSeconds: 900
  }
};

describe("HomeManagementPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    homeApiTesting.reset();
  });

  it("lists existing homes and creates a new one, landing on its detail page", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/homes"]}>
        <AuthSessionProvider initialSession={session}>
          <Routes>
            <Route path="/settings/homes" element={<HomeManagementPage />} />
            <Route path="/settings/homes/:homeId" element={<div>Home Detail Page</div>} />
          </Routes>
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("My Home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create home" }));
    fireEvent.change(screen.getByPlaceholderText("Enter a home name"), {
      target: { value: "Lake House" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Home" }));

    expect(await screen.findByText("Home Detail Page")).toBeInTheDocument();
  });
});
