import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeInTheDocument();
    });
    expect(await screen.findByDisplayValue("High Tank Alert")).toBeInTheDocument();
  });

  it("shows failed dispatch history and replays a failed job from the scene page", async () => {
    sceneApiTesting.seedDemoScenes("user-scene-builder", "home-user-scene-builder", [
      sceneApiTesting.createDemoScene({
        sceneId: "scene-replay",
        userId: "user-scene-builder",
        homeId: "home-user-scene-builder",
        name: "Replay Scene",
        status: "active"
      })
    ]);
    sceneApiTesting.seedDemoDispatches("scene-replay", [
      sceneApiTesting.createDemoDispatch({
        jobId: "dispatch-failed",
        sceneId: "scene-replay",
        homeId: "home-user-scene-builder",
        status: "failed",
        lastError: "dispatcher offline",
        action: {
          type: "notification",
          message: "Dispatch failure"
        }
      })
    ]);

    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/scenes/scene-replay"]}
      >
        <AuthSessionProvider initialSession={session}>
          <Routes>
            <Route path="/scenes/new" element={<SceneBuilderPage />} />
            <Route path="/scenes/:sceneId" element={<SceneBuilderPage />} />
          </Routes>
        </AuthSessionProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Scene Dispatch History")).toBeInTheDocument();
    expect(await screen.findByText("dispatcher offline")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Replay Failed Dispatch" }));

    expect(await screen.findByText(/Replay queued as dispatch-local-/)).toBeInTheDocument();
    expect(await screen.findByText("Replay of dispatch-failed")).toBeInTheDocument();
  });
});
