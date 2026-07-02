import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "../src/index";

describe("StatusPill", () => {
  it("renders the requested label and tone metadata", () => {
    render(<StatusPill label="Foundation Ready" tone="success" />);

    const pill = screen.getByText("Foundation Ready");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveAttribute("data-status", "success");
  });
});
