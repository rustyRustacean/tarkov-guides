import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData, TARKOV_DATA_PROXY_PATH } from "./fetch-tarkov-data";

import type { RawTarkovApiResponseData } from "./types";

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

describe("fetchTarkovGameData", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs the app's own proxy route, not tarkov.dev directly", async () => {
    mockFetchResponse(minimalRawData);
    await fetchTarkovGameData();

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TARKOV_DATA_PROXY_PATH);
  });

  it("returns the already-unwrapped data on success", async () => {
    mockFetchResponse(minimalRawData);
    const result = await fetchTarkovGameData();
    expect(result).toEqual(minimalRawData);
  });

  it("throws using the proxy's own JSON error message when present", async () => {
    mockFetchResponse({ message: "tarkov.dev API responded with HTTP 503" }, false, 502);
    await expect(fetchTarkovGameData()).rejects.toThrow("tarkov.dev API responded with HTTP 503");
  });

  it("falls back to a generic HTTP-status message when the error body has no message", async () => {
    mockFetchResponse({}, false, 502);
    await expect(fetchTarkovGameData()).rejects.toThrow(
      "Tarkov data proxy responded with HTTP 502",
    );
  });

  it("falls back to a generic HTTP-status message when the error body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
      }),
    );
    await expect(fetchTarkovGameData()).rejects.toThrow(
      "Tarkov data proxy responded with HTTP 500",
    );
  });

  it("forwards an AbortSignal when provided", async () => {
    mockFetchResponse(minimalRawData);
    const controller = new AbortController();
    await fetchTarkovGameData(controller.signal);

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });
});
