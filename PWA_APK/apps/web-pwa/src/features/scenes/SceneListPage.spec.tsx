import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { AuthSession } from "@jenix/shared";

import { AuthSessionProvider } from "../../app/AuthSessionProvider";
import { SceneListPage } from "./SceneListPage";
import { sceneApiTesting } from "./services/sceneApi";

const session: AuthSession = {
  user: {
    userId: "user-scenes",
    name: "Scene Operator",
    email: "scene.operator@example.com",
    provider: "email"
  },
  homes: [],
  tokens: {
    accessToken: "access-user-scenes",
    refreshToken: "refresh-user-scenes",
    expiresInSeconds: 900
  }
};

describe("SceneListPage", () => {
  beforeEach(() => {
    sceneApiTesting.reset();
    sceneApiTesting.seedDemoScenes("user-scenes", "home-user-scenes", [
      sceneApiTesting.createDemoScene({
        sceneId: "scene-tank-alert",
        userId: "user-scenes",
        homeId: "home-user-scenes",
        name: "High Tank Alert",
        status: "active"
      })
    ]);
  });

  it("renders the local scene catalog fallback", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <AuthSessionProvider initialSession={session}>
          <SceneListPage />
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("High Tank Alert")).toBeInTheDocument();
    expect(await screen.findByText("Open Builder")).toBeInTheDocument();
  });
});
