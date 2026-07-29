import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../../app/AuthSessionProvider";
import { homeApiTesting } from "../../homes/services/homeApi";
import { HomeManagementSection } from "./HomeManagementSection";

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

describe("HomeManagementSection", () => {
  beforeEach(() => {
    homeApiTesting.reset();
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a new home from the management screen", async () => {
    render(
      <AuthSessionProvider initialSession={session}>
        <HomeManagementSection />
      </AuthSessionProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Create Home" }));
    fireEvent.change(screen.getByPlaceholderText("Enter a home name"), {
      target: { value: "Warehouse" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Home" }));

    expect((await screen.findAllByText("Warehouse")).length).toBeGreaterThan(0);
  });

  it("creates a one-hour invitation code from a home card", async () => {
    render(
      <AuthSessionProvider initialSession={session}>
        <HomeManagementSection />
      </AuthSessionProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Create Home" }));
    fireEvent.change(screen.getByPlaceholderText("Enter a home name"), {
      target: { value: "Warehouse" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Home" }));

    const warehouseCard = (await screen.findAllByText("Warehouse"))[0]!.closest("article");
    expect(warehouseCard).not.toBeNull();
    fireEvent.click(within(warehouseCard!).getByRole("button", { name: "Add Member" }));

    expect(await screen.findByText(/Invitation JNX-/)).toBeInTheDocument();
  });
});
