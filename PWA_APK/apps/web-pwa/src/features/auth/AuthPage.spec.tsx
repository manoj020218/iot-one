import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("renders a single-step login form with email/password fields, Google, and links", () => {
    render(
      <MemoryRouter>
        <AuthSessionProvider>
          <AuthPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.queryByText("Continue with Facebook")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeInTheDocument();
  });
});
