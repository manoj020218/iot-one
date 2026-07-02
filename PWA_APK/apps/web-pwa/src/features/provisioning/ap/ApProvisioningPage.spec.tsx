import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../../app/AuthSessionProvider";
import { ApProvisioningPage } from "./ApProvisioningPage";

const session: AuthSession = {
  user: {
    userId: "user-ap",
    name: "Installer",
    email: "installer@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-ap",
    refreshToken: "refresh-user-ap",
    expiresInSeconds: 900
  }
};

describe("ApProvisioningPage", () => {
  it("renders the AP hotspot instructions and opens the Wi-Fi form", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider initialSession={session}>
          <ApProvisioningPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Join the device hotspot")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "I connected to the hotspot" })
    );

    expect(await screen.findByLabelText("Wi-Fi SSID")).toBeInTheDocument();
  });
});
