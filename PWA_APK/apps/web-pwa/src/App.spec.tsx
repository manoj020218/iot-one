import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("redirects anonymous users to the login page", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });
});
