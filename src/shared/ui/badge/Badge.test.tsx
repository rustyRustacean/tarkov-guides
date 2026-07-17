import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders its text content", () => {
    render(<Badge>Kappa</Badge>);
    expect(screen.getByText("Kappa")).toBeInTheDocument();
  });

  it("applies a status color variant", () => {
    render(<Badge variant="kappa">Kappa</Badge>);
    expect(screen.getByText("Kappa").className).toContain("status-kappa");
  });
});
