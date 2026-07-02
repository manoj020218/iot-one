import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { SceneBuilderPage } from "./SceneBuilderPage";
import { sceneApiTesting } from "./services/sceneApi";

const session: AuthSession = {
  user: {
    userId: "user-scene-builder",
    name: "Builder Operator",
    email: "builder.operator@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-scene-builder",
    refreshToken: "refresh-user-scene-builder",
    expiresInSeconds: 900
  }
};

describe("SceneBuilderPage", () => {
  beforeEach(() => {
    sceneApiTesting.reset();
  });

  it("creates a scene and lands on the editable detail route", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/scenes/new"]}
      >
        <AuthSessionProvider initialSession={session}>
          <Routes>
            <Route path="/scenes/new" element={<SceneBuilderPage />} />
            <Route path="/scenes/:sceneId" element={<SceneBuilderPage />} />
          </Routes>
        </AuthSessionProvider>
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByLabelText("Scene Name"), {
      target: { value: "High Tank Alert" }
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Notify the operator when the tank is high." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Scene" }));

    expect(await screen.findByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("High Tank Alert")).toBeInTheDocument();
  });
});
