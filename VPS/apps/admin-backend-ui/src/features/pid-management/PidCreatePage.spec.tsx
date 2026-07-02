import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { DeveloperSessionProvider } from "../../app/DeveloperSessionProvider";
import { pidApiTesting } from "./services/pidApi";
import { PidCreatePage } from "./PidCreatePage";

describe("PidCreatePage", () => {
  beforeEach(() => {
    pidApiTesting.resetDemoStore();
  });

  it("shows validation messages for an incomplete PID draft", async () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
      >
        <DeveloperSessionProvider>
          <PidCreatePage />
        </DeveloperSessionProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Create PID" }));

    expect(
      await screen.findByText("PID must follow the JNX-... identity format.")
    ).toBeInTheDocument();
    expect(screen.getByText("Product name is required.")).toBeInTheDocument();
    expect(screen.getByText("Hardware MCU is required.")).toBeInTheDocument();
  });
});
