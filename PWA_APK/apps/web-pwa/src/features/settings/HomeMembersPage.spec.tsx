import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import {
  createHomeShareCode,
  homeApiTesting,
  listHomes,
  redeemHomeShareCode
} from "../homes/services/homeApi";
import { HomeMembersPage } from "./HomeMembersPage";

function buildSession(overrides: { userId: string; name: string; email: string }): AuthSession {
  return {
    user: {
      userId: overrides.userId,
      name: overrides.name,
      email: overrides.email,
      provider: "email"
    },
    homes: [],
    tokens: {
      accessToken: `access-${overrides.userId}`,
      refreshToken: `refresh-${overrides.userId}`,
      expiresInSeconds: 900
    }
  };
}

describe("HomeMembersPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    homeApiTesting.reset();
  });

  it("lets the owner change a member's role and remove them", async () => {
    const ownerSeed = buildSession({
      userId: "user-owner-members",
      name: "Priya Owner",
      email: "priya.owner@example.com"
    });
    const memberSeed = buildSession({
      userId: "user-member-members",
      name: "Rahul Member",
      email: "rahul.member@example.com"
    });

    const ownerHomes = await listHomes(ownerSeed);
    const homeId = ownerHomes[0]!.homeId;
    const shareCode = await createHomeShareCode(ownerSeed, homeId, {
      role: "member",
      expiresInHours: 1
    });
    await redeemHomeShareCode(memberSeed, shareCode.code);

    const ownerSession: AuthSession = {
      ...ownerSeed,
      homes: ownerHomes,
      activeHomeId: homeId
    };

    render(
      <MemoryRouter initialEntries={[`/settings/homes/${homeId}/members`]}>
        <AuthSessionProvider initialSession={ownerSession}>
          <Routes>
            <Route path="/settings/homes/:homeId" element={<div>Home Detail Page</div>} />
            <Route path="/settings/homes/:homeId/members" element={<HomeMembersPage />} />
          </Routes>
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Rahul Member")).toBeInTheDocument();
    expect(await screen.findByText("Priya Owner (You)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Rahul Member/ }));

    expect(await screen.findByText("Manage Rahul Member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Admin/ }));

    expect(await screen.findByText("admin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove from home" }));
    fireEvent.click(await screen.findByRole("button", { name: "Tap again to remove" }));

    await waitFor(() => {
      expect(screen.queryByText("Rahul Member")).not.toBeInTheDocument();
    });
  });
});
