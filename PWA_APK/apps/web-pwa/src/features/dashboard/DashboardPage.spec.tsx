import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { DashboardPage } from "./DashboardPage";

const emptyHomeSession: AuthSession = {
  user: {
    userId: "user-dashboard",
    name: "Operator",
    email: "operator@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-dashboard",
    refreshToken: "refresh-user-dashboard",
    expiresInSeconds: 900
  }
};

describe("DashboardPage", () => {
  it("creates the default HOME view and renders the add-device empty state", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider initialSession={emptyHomeSession}>
          <DashboardPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(await screen.findByText("+ Add Device")).toBeInTheDocument();
  });
});
