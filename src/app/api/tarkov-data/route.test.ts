import { describe, expect, it, vi } from "vitest";

import { fetchTarkovDataUpstream } from "@/shared/lib/tarkov-api/fetch-tarkov-data-upstream";

import { GET, revalidate } from "./route";

import type { RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data-upstream", () => ({
  fetchTarkovDataUpstream: vi.fn(),
}));

const minimalRawData: RawTarkovApiResponseData = {
  tasks: [],
  tasksPve: [],
  hideoutStations: [],
  items: [],
  itemsPve: [],
  maps: [],
  traders: [],
  barters: [],
  crafts: [],
};

describe("GET /api/tarkov-data", () => {
  it("returns the fetched data as JSON on success", async () => {
    vi.mocked(fetchTarkovDataUpstream).mockResolvedValue(minimalRawData);
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(minimalRawData);
  });

  it("returns a 502 with the real error message when the upstream fetch fails", async () => {
    vi.mocked(fetchTarkovDataUpstream).mockRejectedValue(
      new Error("tarkov.dev API responded with HTTP 503"),
    );
    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "tarkov.dev API responded with HTTP 503",
    });
  });

  it("returns a generic message for a non-Error rejection", async () => {
    vi.mocked(fetchTarkovDataUpstream).mockRejectedValue("boom");
    const response = await GET();
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      message: "Unknown error fetching tarkov.dev data",
    });
  });

  it("exports a 1-hour revalidate window (the route's own segment config, not the outbound fetch, is what caches this route - see route.ts's doc comment)", () => {
    expect(revalidate).toBe(60 * 60);
  });
});
