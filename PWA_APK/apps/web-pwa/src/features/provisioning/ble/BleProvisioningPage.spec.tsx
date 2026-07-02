import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the BLE scan flow and shows nearby devices", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Start Demo Scan" }));

    expect(await screen.findByText("Nearby provisioning targets")).toBeInTheDocument();
    expect(await screen.findByText("Smart Tank Guard")).toBeInTheDocument();
    expect(await screen.findByLabelText("Quick search")).toBeInTheDocument();
  });
});
