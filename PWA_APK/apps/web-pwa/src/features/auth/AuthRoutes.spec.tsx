import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AppRouter } from "../../app/AppRouter";

describe("Auth routes", () => {
  it("renders the dedicated signup page", async () => {
    render(
      <MemoryRouter initialEntries={["/login/signup"]}>
        <AuthSessionProvider>
          <AppRouter />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Set up your Jenix One access/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("renders the dedicated forgot-password page", async () => {
    render(
      <MemoryRouter initialEntries={["/login/forgot-password"]}>
        <AuthSessionProvider>
          <AppRouter />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Reset your Jenix One password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request password help" })
    ).toBeInTheDocument();
  });
});
