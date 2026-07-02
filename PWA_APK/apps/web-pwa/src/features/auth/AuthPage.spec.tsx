import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  it("renders Google, Facebook, and email login options", () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider>
          <AuthPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(screen.getByText("Continue with Facebook")).toBeInTheDocument();
    expect(screen.getByText("Email Login")).toBeInTheDocument();
  });
});
