import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { homeApiTesting } from "../homes/services/homeApi";
import { HomeDetailPage } from "./HomeDetailPage";

const session: AuthSession = {
  user: {
    userId: "user-home-detail",
    name: "Home Owner",
    email: "home.owner@example.com",
    provider: "email"
  },
  homes: [
    {
      homeId: "home-detail-main",
      name: "My Home",
      ownerUserId: "user-home-detail",
      role: "owner",
      isDefault: true,
      timezone: "Asia/Kolkata",
      locationLabel: "Bengaluru, IN",
      createdAt: "2026-07-10T00:00:00.000Z",
      updatedAt: "2026-07-10T00:00:00.000Z"
    }
  ],
  activeHomeId: "home-detail-main",
  tokens: {
    accessToken: "access-home-detail",
    refreshToken: "refresh-home-detail",
    expiresInSeconds: 900
  }
};

function renderDetailPage() {
  return render(
    <MemoryRouter initialEntries={["/settings/homes/home-detail-main"]}>
      <AuthSessionProvider initialSession={session}>
        <Routes>
          <Route path="/settings/homes" element={<div>Home Management List</div>} />
          <Route path="/settings/homes/:homeId" element={<HomeDetailPage />} />
          <Route
            path="/settings/homes/:homeId/members"
            element={<div>Home Members Page</div>}
          />
        </Routes>
      </AuthSessionProvider>
    </MemoryRouter>
  );
}

describe("HomeDetailPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    homeApiTesting.reset();
  });

  it("shows the home's name, location, and timezone rows", async () => {
    renderDetailPage();

    expect(await screen.findAllByText("My Home")).not.toHaveLength(0);
    expect(screen.getByText("Bengaluru, IN")).toBeInTheDocument();
    expect(screen.getByText("Asia/Kolkata")).toBeInTheDocument();
  });

  it("navigates to the members page from the Home Members row", async () => {
    renderDetailPage();

    fireEvent.click(await screen.findByRole("button", { name: /Home Members/ }));

    expect(await screen.findByText("Home Members Page")).toBeInTheDocument();
  });

  it("navigates back to Home Management", async () => {
    renderDetailPage();

    fireEvent.click(await screen.findByRole("button", { name: /Home Management/ }));

    expect(await screen.findByText("Home Management List")).toBeInTheDocument();
  });
});
