import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AboutLink } from "./AboutLink";

describe("AboutLink", () => {
  it("renders the link with the speech bubble closed", () => {
    render(<AboutLink />);
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });

  it("toggles the speech bubble open and closed on click", async () => {
    const user = userEvent.setup();
    render(<AboutLink />);

    await user.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByText(/feel free to contact me on discord/i)).toBeInTheDocument();
    expect(screen.getByText(/JeffTheJolly/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "About" }));
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });

  it("closes the speech bubble when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <AboutLink />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "About" }));
    expect(screen.getByText(/discord/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByText(/discord/i)).not.toBeInTheDocument();
  });
});
