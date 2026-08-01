import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ItemRow } from "./ItemRow";

import type { TrackedItem } from "../selectors/item-progress";
import type { NormalizedItem, RawMap } from "@/shared/lib/tarkov-api/types";

function makeItem(overrides: Partial<TrackedItem> = {}): TrackedItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    need: 5,
    have: 2,
    pending: 1,
    remaining: 3,
    foundInRaid: false,
    pinned: false,
    source: "task",
    isCustom: false,
    ...overrides,
  };
}

function makeCatalogItem(overrides: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    wikiLink: null,
    basePrice: 0,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    traderSell: 0,
    traderSellVendor: "",
    traderBuy: 0,
    traderBuyVendor: "",
    buyOffers: [],
    avg24hPve: null,
    lastLowPve: null,
    changePve: null,
    ...overrides,
  };
}

const noMaps: readonly RawMap[] = [];

describe("ItemRow", () => {
  it("renders name, need/remaining, and have/pending", () => {
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText(/Need 5/)).toBeInTheDocument();
    expect(screen.getByText(/Remaining 3/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows the FIR badge only when foundInRaid is true", () => {
    const { rerender } = render(
      <ul>
        <ItemRow
          item={makeItem({ foundInRaid: false })}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.queryByText("FIR")).not.toBeInTheDocument();

    rerender(
      <ul>
        <ItemRow
          item={makeItem({ foundInRaid: true })}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("FIR")).toBeInTheDocument();
  });

  it("clicking + calls onAdjustPending with a +1 delta", async () => {
    const user = userEvent.setup();
    const onAdjustPending = vi.fn();
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={onAdjustPending}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Increase pending Item A" }));
    expect(onAdjustPending).toHaveBeenCalledWith("item-a", 1);
  });

  it("editing the have input calls onEditStash", () => {
    const onEditStash = vi.fn();
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={onEditStash}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    const haveInput = screen.getByLabelText("Have");
    fireEvent.change(haveInput, { target: { value: "9" } });
    expect(onEditStash).toHaveBeenCalledWith("item-a", "Item A", 9);
  });

  it("double-clicking the row calls onTogglePin", async () => {
    const user = userEvent.setup();
    const onTogglePin = vi.fn();
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={onTogglePin}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    await user.dblClick(screen.getByTitle("Click for details · double-click to pin/unpin"));
    expect(onTogglePin).toHaveBeenCalledWith("item-a");
  });

  it("toggles pin via a real, single-click, keyboard-reachable button - regression test for a keyboard-accessibility gap", async () => {
    const user = userEvent.setup();
    const onTogglePin = vi.fn();
    const { rerender } = render(
      <ul>
        <ItemRow
          item={makeItem({ pinned: false })}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={onTogglePin}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    const pinButton = screen.getByRole("button", { name: "Pin Item A" });
    expect(pinButton).toHaveAttribute("aria-pressed", "false");

    await user.click(pinButton);
    expect(onTogglePin).toHaveBeenCalledWith("item-a");

    rerender(
      <ul>
        <ItemRow
          item={makeItem({ pinned: true })}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={onTogglePin}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Unpin Item A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows a Remove button only when isCustom is true, wired to onRemoveCustom", async () => {
    const user = userEvent.setup();
    const onRemoveCustom = vi.fn();
    render(
      <ul>
        <ItemRow
          item={makeItem({ isCustom: true })}
          catalogItem={undefined}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={onRemoveCustom}
        />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemoveCustom).toHaveBeenCalledWith("item-a", "Item A");
  });

  it("shows Fill Remaining/Clear instead of the stepper when the catalog item is money", () => {
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={makeCatalogItem({ types: ["money"] })}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Fill Remaining" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Increase pending Item A" }),
    ).not.toBeInTheDocument();
  });

  it("shows the flea tax/net readout when the catalog item has a base price and a list price", () => {
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={makeCatalogItem({ basePrice: 10000, lastLowPrice: 15000 })}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText(/Flea 15,000₽/)).toBeInTheDocument();
    expect(screen.getByText(/net/)).toBeInTheDocument();
  });

  it("omits the flea readout when the catalog item has no usable price data", () => {
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={makeCatalogItem({ basePrice: 0 })}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.queryByText(/Flea/)).not.toBeInTheDocument();
  });

  it("expands a curated location hint on click when one resolves for the item", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <ItemRow
          item={makeItem({ shortName: "LEDX" })}
          catalogItem={makeCatalogItem({ shortName: "LEDX", name: "LEDX Skin Transilluminator" })}
          maps={[
            {
              name: "Customs",
              normalizedName: "customs",
              raidDuration: null,
              players: null,
              bosses: [],
            },
          ]}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    const toggle = screen.getByRole("button", { name: /Where to find/ });
    expect(screen.queryByText(/Medbags/)).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText(/Medbags/)).toBeInTheDocument();
    expect(screen.getByText(/Customs:/)).toBeInTheDocument();
  });

  it("shows no location hint toggle for an item with no curated entry", () => {
    render(
      <ul>
        <ItemRow
          item={makeItem()}
          catalogItem={makeCatalogItem({ shortName: "ZZZ", name: "Totally uncurated item" })}
          maps={noMaps}
          onAdjustPending={vi.fn()}
          onEditStash={vi.fn()}
          onFillMoney={vi.fn()}
          onTogglePin={vi.fn()}
          onRemoveCustom={vi.fn()}
        />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: /Where to find/ })).not.toBeInTheDocument();
  });
});
