import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FAQItem } from "./FAQItem";

describe("FAQItem", () => {
  it("renders the question collapsed, with the answer hidden", () => {
    render(<FAQItem question="Is this a question?" answer="Yes, it is." />);

    expect(screen.getByRole("button", { name: "Is this a question?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Yes, it is.")).not.toBeInTheDocument();
  });

  it("expands to show the answer on click, and collapses again on a second click", async () => {
    const user = userEvent.setup();
    render(<FAQItem question="Is this a question?" answer="Yes, it is." />);

    const button = screen.getByRole("button", { name: "Is this a question?" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Yes, it is.")).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Yes, it is.")).not.toBeInTheDocument();
  });
});
