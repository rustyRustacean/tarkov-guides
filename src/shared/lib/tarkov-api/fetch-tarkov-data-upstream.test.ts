import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TARKOV_API_ENDPOINT } from "./constants";
import { fetchTarkovDataUpstream } from "./fetch-tarkov-data-upstream";

import type { RawTarkovApiResponseData } from "./types";

const minimalRawData: RawTarkovApiResponseData = {
  tasks: [],
  hideoutStations: [],
  items: [],
  itemsPve: [],
  maps: [],
  traders: [],
  barters: [],
  crafts: [],
};

function mockFetchResponse(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

describe("fetchTarkovDataUpstream", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("POSTs to the tarkov.dev endpoint with the expected body shape", async () => {
    mockFetchResponse({ data: minimalRawData });
    await fetchTarkovDataUpstream();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TARKOV_API_ENDPOINT);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const parsedBody = JSON.parse(init.body as string) as { query: string };
    expect(parsedBody.query).toContain("tasks(lang: en, gameMode: regular)");
  });

  it("returns the data section on success", async () => {
    mockFetchResponse({ data: minimalRawData });
    const result = await fetchTarkovDataUpstream();
    expect(result).toEqual(minimalRawData);
  });

  it("continues with partial data when errors accompany a data section", async () => {
    mockFetchResponse({
      data: minimalRawData,
      errors: [{ message: "partial translation outage" }],
    });
    const result = await fetchTarkovDataUpstream();
    expect(result).toEqual(minimalRawData);
  });

  it("throws when data is entirely missing", async () => {
    mockFetchResponse({ errors: [{ message: "boom" }] });
    await expect(fetchTarkovDataUpstream()).rejects.toThrow("boom");
  });

  it("throws a generic message when data is missing and there are no errors either", async () => {
    mockFetchResponse({});
    await expect(fetchTarkovDataUpstream()).rejects.toThrow("tarkov.dev API returned no data");
  });

  it("throws on a non-2xx HTTP response", async () => {
    mockFetchResponse({}, false, 503);
    await expect(fetchTarkovDataUpstream()).rejects.toThrow("HTTP 503");
  });

  it("forwards an AbortSignal when provided", async () => {
    mockFetchResponse({ data: minimalRawData });
    const controller = new AbortController();
    await fetchTarkovDataUpstream(controller.signal);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
