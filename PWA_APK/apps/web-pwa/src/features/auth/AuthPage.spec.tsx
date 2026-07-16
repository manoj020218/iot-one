import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  afterEach(() => {
    cleanup();
    delete (
      window as Window & {
        Capacitor?: unknown;
      }
    ).Capacitor;
  });

  it("renders quick access with Google and text links", () => {
    render(
      <MemoryRouter>
        <AuthSessionProvider>
          <AuthPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.queryByText("Continue with Facebook")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use email address" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new account" })).toBeInTheDocument();
  });

  it("opens the email sheet from quick access", async () => {
    render(
      <MemoryRouter>
        <AuthSessionProvider>
          <AuthPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Use email address" })[0]!);
    expect(await screen.findByText("Sign in with email")).toBeInTheDocument();
  });
});
