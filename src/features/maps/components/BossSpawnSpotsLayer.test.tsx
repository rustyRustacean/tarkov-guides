import { act, render } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useBossSpawnStore, type ShownBossSpawns } from "../boss-spawn-store";

import { BossSpawnSpotsLayer } from "./BossSpawnSpotsLayer";

const RESHALA: ShownBossSpawns = {
  map: "customs",
  mode: "PVP",
  name: "Reshala",
  imagePortraitLink: "https://assets.tarkov.dev/reshala-portrait.png",
  tone: "hot",
  spots: [
    { x: 10, z: 20, zone: "Stronghold" },
    { x: 12, z: 24, zone: "Stronghold" },
  ],
  zonesWithoutSpots: [],
};

function renderLayer(map = "customs") {
  return render(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      <BossSpawnSpotsLayer normalizedMapName={map} />
    </MapContainer>,
  );
}

function spots(container: HTMLElement): NodeListOf<Element> {
  return container.querySelectorAll(".boss-spawn-spot");
}

describe("BossSpawnSpotsLayer", () => {
  beforeEach(() => {
    useProgressTrackerStore.setState({ activeMode: "PVP" });
    useBossSpawnStore.setState({ shown: null });
  });

  it("draws one portrait marker per spot", () => {
    useBossSpawnStore.getState().show(RESHALA);
    const { container } = renderLayer();
    expect(spots(container)).toHaveLength(2);
    const portrait = spots(container)[0]?.querySelector("img");
    expect(portrait?.getAttribute("src")).toBe(RESHALA.imagePortraitLink);
    expect(portrait?.getAttribute("alt")).toBe("");
  });

  it("falls back to initials when there's no portrait", () => {
    useBossSpawnStore.getState().show({ ...RESHALA, imagePortraitLink: null });
    const { container } = renderLayer();
    expect(spots(container)[0]?.textContent).toBe("RE");
  });

  it("draws nothing on another map or in another mode, and nothing once cleared", () => {
    useBossSpawnStore.getState().show(RESHALA);
    expect(spots(renderLayer("woods").container)).toHaveLength(0);

    const { container } = renderLayer();
    act(() => {
      useProgressTrackerStore.setState({ activeMode: "PVE" });
    });
    expect(spots(container)).toHaveLength(0);

    act(() => {
      useProgressTrackerStore.setState({ activeMode: "PVP" });
      useBossSpawnStore.getState().clear();
    });
    expect(spots(container)).toHaveLength(0);
  });
});
