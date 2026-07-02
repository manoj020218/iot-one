import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppRouter } from "./AppRouter";
import { DeveloperSessionProvider } from "./DeveloperSessionProvider";

describe("AppRouter", () => {
  it("blocks non-developer roles from PID routes", () => {
    render(
      <MemoryRouter
        initialEntries={["/admin/developer/pid-management"]}
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <DeveloperSessionProvider
          initialSession={{
            actorId: "viewer",
            name: "Viewer",
            role: "VIEWER"
          }}
        >
          <AppRouter />
        </DeveloperSessionProvider>
      </MemoryRouter>
    );

    expect(screen.getByText("Developer Access Required")).toBeInTheDocument();
  });
});
