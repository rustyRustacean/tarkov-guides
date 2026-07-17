import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders the community disclaimer", () => {
    render(<Footer />);
    expect(
      screen.getByText("Built for the Tarkov community. Not affiliated with Battlestate Games."),
    ).toBeInTheDocument();
  });
});
