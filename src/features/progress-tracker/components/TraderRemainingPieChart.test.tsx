import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TraderRemainingPieChart } from "./TraderRemainingPieChart";

describe("TraderRemainingPieChart", () => {
  it("shows a completion message instead of a chart when nothing remains", () => {
    render(<TraderRemainingPieChart data={[]} />);
    expect(screen.getByText(/every trader is fully complete/i)).toBeInTheDocument();
  });

  it("lists every trader's remaining count in the legend, plus the grand total", () => {
    render(
      <TraderRemainingPieChart
        data={[
          { traderName: "Prapor", remaining: 5 },
          { traderName: "Skier", remaining: 2 },
        ]}
      />,
    );

    expect(screen.getByText("Prapor")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Skier")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    // Center label - grand total across all traders.
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
