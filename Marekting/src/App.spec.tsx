import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("marketing site routes", () => {
  it("renders the homepage with core calls to action", () => {
    renderRoute("/");
    expect(
      screen.getByRole("heading", {
        name: /build, connect and manage iot products on one platform/i
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /open smart one/i })[0]).toHaveAttribute(
      "href",
      "https://app.iotsoft.in"
    );
  });

  it("renders policy content on the privacy route", () => {
    renderRoute("/privacy");
    expect(screen.getByRole("heading", { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/how smart one by jenix collects, uses, stores/i)).toBeInTheDocument();
  });

  it("falls back to the homepage for unknown routes", () => {
    renderRoute("/does-not-exist");
    expect(screen.getByRole("heading", { name: /build, connect and manage/i })).toBeInTheDocument();
  });

  it("opens the mobile menu and exposes key routes", async () => {
    const user = userEvent.setup();
    renderRoute("/");
    await user.click(screen.getByRole("button", { name: /menu/i }));
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: /developers/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /^contact$/i })).toBeInTheDocument();
  });
});
