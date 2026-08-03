import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ContactLink } from "./ContactLink";

describe("ContactLink", () => {
  it("renders the link with the speech bubble closed", () => {
    render(<ContactLink />);
    expect(screen.getByRole("button", { name: "Contact us" })).toBeInTheDocument();
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });

  it("toggles the speech bubble open and closed on click", async () => {
    const user = userEvent.setup();
    render(<ContactLink />);

    await user.click(screen.getByRole("button", { name: "Contact us" }));
    expect(screen.getByText(/tarkovguides@protonmail\.com/)).toBeInTheDocument();
    expect(screen.getByText("JeffTheJolly")).toBeInTheDocument();
    expect(screen.getByText("xnikolai09x")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Contact us" }));
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });

  it("closes the speech bubble when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <ContactLink />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Contact us" }));
    expect(screen.getByText(/tarkovguides@protonmail\.com/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });
});
