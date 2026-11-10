import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useBossSpawnStore, type ShownBossSpawns } from "../boss-spawn-store";
import { getMapConfig, variantHasAccurateMarkers } from "../lib/map-config";
import { useMapsStore } from "../store";

import { BossSpawnSpotsChip } from "./BossSpawnSpotsChip";

const RESHALA: ShownBossSpawns = {
  map: "customs",
  mode: "PVP",
  name: "Reshala",
  imagePortraitLink: null,
  tone: "hot",
  spots: [{ x: 10, z: 20, zone: "Stronghold" }],
  zonesWithoutSpots: ["Dorms", "New Gas Station"],
};

/** A Customs view that can place markers, so the chip has nothing to warn about. */
function markerViewOf(map: string): string {
  const view = getMapConfig(map)?.variants.find((variant) => variantHasAccurateMarkers(variant));
  if (!view) throw new Error(`no marker view on ${map}`);
  return view.id;
}

describe("BossSpawnSpotsChip", () => {
  beforeEach(() => {
    useProgressTrackerStore.setState({ activeMode: "PVP" });
    useMapsStore.setState({ mapVariants: { customs: markerViewOf("customs") } });
    useBossSpawnStore.setState({ shown: null });
  });

  it("says whose spots are shown, that they aren't sightings, and which zones list none", () => {
    useBossSpawnStore.getState().show(RESHALA);
    render(<BossSpawnSpotsChip normalizedName="customs" />);
    const label = screen.getByText("Showing Reshala's possible spawn spots");
    expect(label.parentElement).toHaveAttribute(
      "title",
      "Possible spawn spots from tarkov.dev's data, not live sightings. No spots are listed for Dorms and New Gas Station.",
    );
  });

  it("clears the spots from its × button", async () => {
    useBossSpawnStore.getState().show(RESHALA);
    render(<BossSpawnSpotsChip normalizedName="customs" />);
    await userEvent.click(screen.getByRole("button", { name: "Hide Reshala's spawn spots" }));
    expect(useBossSpawnStore.getState().shown).toBeNull();
    expect(screen.queryByText(/possible spawn spots/)).not.toBeInTheDocument();
  });

  it("shows nothing on another map", () => {
    useBossSpawnStore.getState().show(RESHALA);
    render(<BossSpawnSpotsChip normalizedName="woods" />);
    expect(screen.queryByText(/spawn spots/)).not.toBeInTheDocument();
  });

  it("offers a view that can place the spots when the current one can't", async () => {
    useMapsStore.setState({ mapVariants: { customs: "2d" } });
    useBossSpawnStore.getState().show(RESHALA);
    render(<BossSpawnSpotsChip normalizedName="customs" />);
    expect(screen.getByText("This view can't place Reshala's spawn spots")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Show on / }));
    const config = getMapConfig("customs");
    const view = config?.variants.find(
      (variant) => variant.id === useMapsStore.getState().mapVariants.customs,
    );
    expect(view && variantHasAccurateMarkers(view)).toBe(true);
    expect(screen.getByText("Showing Reshala's possible spawn spots")).toBeInTheDocument();
  });
});
