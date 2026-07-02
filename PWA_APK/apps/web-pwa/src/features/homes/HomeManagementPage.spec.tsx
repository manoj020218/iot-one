import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { HomeManagementPage } from "./HomeManagementPage";
import { homeApiTesting } from "./services/homeApi";

const session: AuthSession = {
  user: {
    userId: "user-home-manager",
    name: "Home Manager",
    email: "home.manager@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-home-manager",
    refreshToken: "refresh-user-home-manager",
    expiresInSeconds: 900
  }
};

describe("HomeManagementPage", () => {
  beforeEach(() => {
    homeApiTesting.reset();
  });

  it("renders the default HOME and creates a local share code fallback", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider initialSession={session}>
          <HomeManagementPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Choose the home you are operating right now")).toBeInTheDocument();
    expect((await screen.findAllByText("HOME")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Create Share Code" }));

    expect(await screen.findByText(/Latest code:/)).toBeInTheDocument();
  });
});
