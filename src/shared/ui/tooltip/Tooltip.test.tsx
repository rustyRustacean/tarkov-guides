import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";

describe("Tooltip", () => {
  it("shows its content when the trigger receives focus", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful info</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.tab();

    // Radix renders the tooltip text twice - once visibly, once in a
    // visually-hidden span (role="tooltip") for screen readers - so query
    // the accessibility node specifically rather than by text, which would
    // match both.
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Helpful info");
  });
});
