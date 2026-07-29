import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovDataUpstream } from "./fetch-tarkov-data-upstream";

const EMPTY_ENVELOPES: Record<string, unknown> = {
  "https://json.tarkov.dev/regular/items": { data: { items: {} }, translations: [] },
  "https://json.tarkov.dev/regular/items_en": { data: {} },
  "https://json.tarkov.dev/pve/items": { data: { items: {} }, translations: [] },
  "https://json.tarkov.dev/regular/tasks": { data: { tasks: {}, prestige: [] }, translations: [] },
  "https://json.tarkov.dev/regular/tasks_en": { data: {} },
  "https://json.tarkov.dev/regular/traders": { data: {}, translations: [] },
  "https://json.tarkov.dev/regular/traders_en": { data: {} },
  "https://json.tarkov.dev/regular/hideout": { data: {}, translations: [] },
  "https://json.tarkov.dev/regular/hideout_en": { data: {} },
  "https://json.tarkov.dev/regular/maps": { data: { maps: {} }, translations: [] },
  "https://json.tarkov.dev/regular/maps_en": { data: {} },
  "https://json.tarkov.dev/regular/barters": { data: [], translations: [] },
  "https://json.tarkov.dev/regular/crafts": { data: [], translations: [] },
};

const EMPTY_RESULT = {
  tasks: [],
  hideoutStations: [],
  items: [],
  itemsPve: [],
  maps: [],
  traders: [],
  barters: [],
  crafts: [],
};

/** Mocks `fetch` per-URL. `overrides` maps a URL to either a replacement body or an HTTP status to fail with. */
function mockFetch(
  overrides: Record<string, Record<string, unknown> | { status: number }> = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string) => {
    const override = overrides[url];
    if (override && typeof override === "object" && "status" in override) {
      return Promise.resolve({
        ok: false,
        status: override.status,
        json: () => Promise.resolve({}),
      });
    }
    const body = override ?? EMPTY_ENVELOPES[url];
    if (body === undefined) {
      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchTarkovDataUpstream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fetches every resource and returns the joined (all-empty) result", async () => {
    mockFetch();
    const result = await fetchTarkovDataUpstream();
    expect(result).toEqual(EMPTY_RESULT);
  });

  it("resolves real translated names end-to-end", async () => {
    mockFetch({
      "https://json.tarkov.dev/regular/items": {
        data: {
          items: {
            "item-1": {
              id: "item-1",
              name: "item-1 Name",
              shortName: "item-1 ShortName",
              iconLink: null,
              wikiLink: null,
              basePrice: 100,
              width: 1,
              height: 1,
              avg24hPrice: null,
              lastLowPrice: null,
              changeLast48hPercent: null,
              types: [],
              buyFromTrader: [],
              sellToTrader: [],
            },
          },
        },
        translations: ["$.data.items.*.name", "$.data.items.*.shortName"],
      },
      "https://json.tarkov.dev/regular/items_en": {
        data: { "item-1 Name": "LEDX Skin Transilluminator", "item-1 ShortName": "LEDX" },
      },
    });

    const result = await fetchTarkovDataUpstream();
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "item-1",
        name: "LEDX Skin Transilluminator",
        shortName: "LEDX",
      }),
    ]);
  });

  it("continues with an empty section when one resource fails, without failing the whole fetch", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockFetch({ "https://json.tarkov.dev/regular/barters": { status: 500 } });

    const result = await fetchTarkovDataUpstream();
    expect(result.barters).toEqual([]);
    expect(result.tasks).toEqual([]);
  });

  it("falls back to untranslated data when only the translation dictionary fetch fails", async () => {
    mockFetch({
      "https://json.tarkov.dev/regular/traders": {
        data: {
          "trader-1": {
            id: "trader-1",
            name: "trader-1 Nickname",
            normalizedName: "prapor",
            imageLink: null,
          },
        },
        translations: ["$.data.*.name"],
      },
      "https://json.tarkov.dev/regular/traders_en": { status: 500 },
    });

    const result = await fetchTarkovDataUpstream();
    expect(result.traders).toEqual([
      { id: "trader-1", name: "trader-1 Nickname", normalizedName: "prapor", imageLink: null },
    ]);
  });

  it("throws when every resource fails", async () => {
    const allFailing = Object.fromEntries(
      Object.keys(EMPTY_ENVELOPES).map((url) => [url, { status: 503 }]),
    );
    mockFetch(allFailing);

    await expect(fetchTarkovDataUpstream()).rejects.toThrow("HTTP 503");
  });

  it("forwards an AbortSignal to every fetch call", async () => {
    const fetchMock = mockFetch();
    const controller = new AbortController();
    await fetchTarkovDataUpstream(controller.signal);

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.signal).toBe(controller.signal);
    }
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
  });
});
