import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchJsonApiResource } from "@/shared/lib/tarkov-api/fetch-json-resource";

import { FAILURE_MEMORY_MS, MAP_DATA_TTL_MS } from "../lib/route-limits";

import {
  getMapRouteData,
  NO_MAP_DATA,
  readMapRouteData,
  resetMapRouteData,
} from "./map-route-data";

import type { JsonApiMapsData } from "@/shared/lib/tarkov-api/json-api-types";

vi.mock("@/shared/lib/tarkov-api/fetch-json-resource", () => ({
  fetchJsonApiResource: vi.fn(),
}));

const fetchMaps = vi.mocked(fetchJsonApiResource);

function payload(): JsonApiMapsData {
  return {
    maps: {
      a: {
        name: "Customs",
        normalizedName: "customs",
        raidDuration: null,
        players: null,
        extracts: [
          { id: "e1", name: "x", faction: "pmc", position: { x: 10, y: 0, z: 20 } },
          { id: "e2", name: "x", faction: "pmc", position: null },
          { id: "e3", name: "x", faction: "pmc", position: { x: 999999, y: 0, z: 0 } },
        ],
        transits: [{ id: "t1", description: "x", map: "b", position: { x: -5, y: 0, z: 7 } }],
        hazards: [
          {
            hazardType: "minefield",
            name: "ok",
            outline: [
              { x: 0, y: 0, z: 0 },
              { x: 10, y: 0, z: 0 },
              { x: 10, y: 0, z: 10 },
            ],
          },
          {
            hazardType: "minefield",
            name: "bad point",
            outline: [
              { x: 0, y: 0, z: 0 },
              { x: 1e9, y: 0, z: 0 },
              { x: 10, y: 0, z: 10 },
            ],
          },
          { hazardType: "sniper", name: "not a minefield", outline: null },
        ],
      },
    },
  };
}

beforeEach(() => {
  resetMapRouteData();
  fetchMaps.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("readMapRouteData", () => {
  it("keeps good exits and minefields and drops malformed ones", () => {
    const data = readMapRouteData(payload()).get("customs");
    expect(data?.anchors).toEqual([
      { x: 10, z: 20 },
      { x: -5, z: 7 },
    ]);
    expect(data?.minefields).toHaveLength(1);
  });
});

describe("getMapRouteData", () => {
  it("fetches once and reuses the data until it is old", async () => {
    fetchMaps.mockResolvedValue(payload());
    const t = 1_000_000;
    expect(await getMapRouteData("customs", t)).not.toBeNull();
    await getMapRouteData("customs", t + 1000);
    expect(fetchMaps).toHaveBeenCalledTimes(1);
    await getMapRouteData("customs", t + MAP_DATA_TTL_MS + 1);
    expect(fetchMaps).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failed fetch on every request", async () => {
    fetchMaps.mockRejectedValue(new Error("down"));
    const t = Date.now();
    expect(await getMapRouteData("customs", t)).toBe(NO_MAP_DATA);
    expect(await getMapRouteData("customs", t + 1000)).toBe(NO_MAP_DATA);
    expect(fetchMaps).toHaveBeenCalledTimes(1);
    expect(await getMapRouteData("customs", t + FAILURE_MEMORY_MS + 1)).toBe(NO_MAP_DATA);
    expect(fetchMaps).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good data when a refresh fails", async () => {
    fetchMaps.mockResolvedValueOnce(payload());
    const t = Date.now();
    const first = await getMapRouteData("customs", t);
    fetchMaps.mockRejectedValue(new Error("down"));
    const later = await getMapRouteData("customs", t + MAP_DATA_TTL_MS + 1);
    expect(later).toEqual(first);
  });

  it("returns null for a map the data does not list", async () => {
    fetchMaps.mockResolvedValue(payload());
    expect(await getMapRouteData("nowhere")).toBeNull();
  });
});
