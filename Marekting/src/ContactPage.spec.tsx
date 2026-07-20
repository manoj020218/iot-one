import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ContactPage } from "./pages/ContactPage";

describe("contact page", () => {
  it("prepares an enquiry draft after valid submission", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/full name/i), "Amit Sharma");
    await user.type(screen.getByLabelText(/business email/i), "amit@example.com");
    await user.type(screen.getByLabelText(/phone number/i), "9999999999");
    await user.type(screen.getByLabelText(/^company$/i), "Jenix Partner");
    await user.type(screen.getByLabelText(/country/i), "India");
    await user.type(screen.getByLabelText(/project description/i), "Need OEM rollout for 500 devices.");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /prepare enquiry/i }));

    expect(screen.getByText(/your enquiry draft is ready/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open email draft/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:jenixindia@gmail.com")
    );
  });
});
