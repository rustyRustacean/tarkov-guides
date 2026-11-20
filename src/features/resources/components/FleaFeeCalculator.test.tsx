import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";
import { formatRoubles } from "@/shared/lib/format-roubles";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { makeNormalizedItem } from "../test-fixtures";

import { FleaFeeCalculator } from "./FleaFeeCalculator";

vi.mock("@/shared/lib/tarkov-api/use-tarkov-game-data", () => ({
  useTarkovGameData: vi.fn(),
}));

const GPU = makeNormalizedItem({
  id: "gpu",
  name: "Graphics card",
  shortName: "GPU",
  basePrice: 100_000,
  avg24hPrice: 300_000,
  avg24hPve: 250_000,
  traderSell: 120_000,
  traderSellVendor: "Mechanic",
});
const NOTE = makeNormalizedItem({
  id: "note",
  name: "Secret note",
  shortName: "Note",
  types: ["noFlea"],
});

const initialProgressState = useProgressTrackerStore.getInitialState();

function mockGameData(items: readonly ReturnType<typeof makeNormalizedItem>[] | undefined): void {
  vi.mocked(useTarkovGameData).mockReturnValue({
    data: items ? { items } : undefined,
    isPending: items === undefined,
  } as unknown as ReturnType<typeof useTarkovGameData>);
}

function pickItem(query: string, name: string): void {
  fireEvent.change(screen.getByLabelText("Item"), { target: { value: query } });
  fireEvent.click(
    within(screen.getByRole("list", { name: "Matching items" })).getByRole("button", {
      name: new RegExp(name),
    }),
  );
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  mockGameData([GPU, NOTE]);
});

describe("FleaFeeCalculator", () => {
  it("waits for item data before searching", () => {
    mockGameData(undefined);
    render(<FleaFeeCalculator />);

    expect(screen.getByLabelText("Item")).toBeDisabled();
    expect(screen.getByLabelText("Item")).toHaveAttribute("placeholder", "Loading items…");
  });

  it("fills in the active mode's flea price and shows the fee and what's left", () => {
    useProgressTrackerStore.setState({ activeMode: "PVE" });
    render(<FleaFeeCalculator />);

    pickItem("gpu", "Graphics card");

    expect(screen.getByLabelText("List price per item (₽)")).toHaveValue("250000");
    expect(screen.getByText(formatRoubles(calculateFleaTax(100_000, 250_000)))).toBeInTheDocument();
    expect(screen.getByText(formatRoubles(calculateFleaNet(100_000, 250_000)))).toBeInTheDocument();
    expect(screen.getByText(/so the flea comes out ahead/)).toBeInTheDocument();
  });

  it("multiplies by the quantity", () => {
    render(<FleaFeeCalculator />);
    pickItem("gpu", "Graphics card");

    fireEvent.click(screen.getByRole("button", { name: "Increase Quantity" }));

    expect(
      screen.getByText(formatRoubles(calculateFleaNet(100_000, 300_000, 2))),
    ).toBeInTheDocument();
  });

  it("says when the trader beats a low listing", () => {
    render(<FleaFeeCalculator />);
    pickItem("gpu", "Graphics card");

    fireEvent.change(screen.getByLabelText("List price per item (₽)"), {
      target: { value: "121,000" },
    });

    expect(screen.getByText(/Mechanic pays/)).toHaveTextContent("beats this listing");
  });

  it("offers to restore the market price after the price is changed", () => {
    render(<FleaFeeCalculator />);
    pickItem("gpu", "Graphics card");
    const price = screen.getByLabelText("List price per item (₽)");

    fireEvent.change(price, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Use the PvP 24h average/ }));

    expect(price).toHaveValue("300000");
  });

  it("asks for a price when there's no market price to suggest", () => {
    render(<FleaFeeCalculator />);
    pickItem("note", "Secret note");

    expect(screen.getByLabelText("List price per item (₽)")).toHaveValue("");
    expect(screen.getByText("Enter a list price to see the fee.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("not sellable on the flea market");
  });

  it("clears the picked item", () => {
    render(<FleaFeeCalculator />);
    pickItem("gpu", "Graphics card");

    fireEvent.click(screen.getByRole("button", { name: "Clear item" }));

    expect(screen.getByText("Pick an item to get started.")).toBeInTheDocument();
    expect(screen.getByLabelText("List price per item (₽)")).toBeDisabled();
  });
});
