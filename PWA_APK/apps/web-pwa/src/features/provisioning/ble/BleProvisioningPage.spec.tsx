import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../../app/AuthSessionProvider";
import { BleProvisioningPage } from "./BleProvisioningPage";

const session: AuthSession = {
  user: {
    userId: "user-ble",
    name: "Installer",
    email: "installer@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-ble",
    refreshToken: "refresh-user-ble",
    expiresInSeconds: 900
  }
};

describe("BleProvisioningPage", () => {
  it("automatically scans on load and shows nearby devices", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider initialSession={session}>
          <BleProvisioningPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Nearby provisioning targets")).toBeInTheDocument();
    expect(await screen.findByText("Smart Tank Guard")).toBeInTheDocument();
    expect(await screen.findByLabelText("Quick search")).toBeInTheDocument();
  });
});
