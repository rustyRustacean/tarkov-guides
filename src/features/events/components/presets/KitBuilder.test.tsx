import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildCatalogIndex } from "../../catalog/catalog-index";

import { KitBuilder } from "./KitBuilder";

import type { ItemCatalog } from "../../catalog/catalog-types";
import type { Kit, Preset } from "../../types";

vi.mock("@/shared/lib/tarkov-api/use-tarkov-game-data", () => ({
  useTarkovGameData: () => ({ data: { items: [] }, isPending: false }),
}));

const CATALOG: ItemCatalog = {
  version: 1,
  categories: [
    { id: "weapons", name: "Weapons", slug: "weapons", parent: null, icon: null },
    {
      id: "bolt",
      name: "Bolt-action rifles",
      slug: "bolt-action-rifles",
      parent: "weapons",
      icon: null,
    },
    { id: "dmr", name: "Marksman rifles", slug: "marksman-rifles", parent: "weapons", icon: null },
    { id: "meds", name: "Medication", slug: "medication", parent: null, icon: null },
  ],
  items: { m700: { c: "bolt" }, rsass: { c: "dmr" }, morphine: { c: "meds" } },
};
const index = buildCatalogIndex(CATALOG);
const NAMES = {
  item: (id: string) => ({ m700: "M700", rsass: "RSASS", morphine: "Morphine" })[id] ?? id,
  category: (id: string) => index.categoriesById.get(id)?.name ?? id,
  icon: () => null,
};
const PRESET: Preset = {
  id: "bolt",
  name: "Bolt-action specialist",
  description: "",
  rules: [
    {
      id: "weapons-only",
      kind: "allowOnly",
      scope: { type: "category", id: "weapons" },
      allowed: [{ type: "category", id: "bolt" }],
    },
    { id: "one-morphine", kind: "cap", target: { type: "item", id: "morphine" }, max: 1 },
  ],
};

function renderKit(kit: Kit, onKitChange = vi.fn()) {
  render(
    <KitBuilder
      kit={kit}
      onKitChange={onKitChange}
      preset={PRESET}
      index={index}
      names={NAMES}
      kitLink={() => Promise.resolve("https://example.com/kit")}
    />,
  );
  return onKitChange;
}

describe("KitBuilder", () => {
  it("says a kit follows the preset when it does", () => {
    renderKit({ slots: { primary: { itemId: "m700", attachments: [] } }, carried: [] });
    expect(screen.getByText("Kit follows the preset")).toBeInTheDocument();
  });

  it("lists each broken rule and marks the items that broke it", () => {
    renderKit({
      slots: { primary: { itemId: "rsass", attachments: [] } },
      carried: [{ itemId: "morphine", qty: 2 }],
    });
    expect(screen.getByText("2 problems")).toBeInTheDocument();
    const problems = screen.getByRole("list", { name: "Problems" });
    expect(
      within(problems).getByText("Weapons: only Bolt-action rifles allowed"),
    ).toBeInTheDocument();
    expect(within(problems).getByText("At most 1× Morphine (this kit has 2)")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Breaks a rule").length).toBeGreaterThanOrEqual(2);
  });

  it("removes a slot's item", () => {
    const onKitChange = renderKit({
      slots: { primary: { itemId: "m700", attachments: [] } },
      carried: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove M700" }));
    expect(onKitChange).toHaveBeenCalledWith({ slots: {}, carried: [] });
  });
});
