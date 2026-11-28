import { LiveblocksError } from "@liveblocks/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashSecretKey } from "../../events/lib/event-keys";
import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";

import { DELETE, GET, POST, PUT } from "./route";

vi.mock("../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

const ID = "abcdefghjk";
const KEY = "K".repeat(43);
const WRONG_KEY = "W".repeat(43);
let ipCounter = 0;

const PRESET = {
  id: ID,
  name: "Bolt-action specialist",
  description: "No body armor",
  rules: [{ id: "r1", kind: "ban", target: { type: "category", id: "body-armor" } }],
};

function request(method: string, body?: unknown): Request {
  return new Request(`https://example.com/api/event-presets/${ID}`, {
    method,
    headers: {
      "x-forwarded-for": `10.4.0.${String(++ipCounter)}`,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function ctx(id = ID) {
  return { params: Promise.resolve({ id }) };
}

function metadata(status = "listed") {
  return {
    kind: "preset",
    status,
    name: PRESET.name,
    uses: "3",
    rules: "1",
    publishedAt: "2026-11-27T00:00:00.000Z",
    manageKeyHash: hashSecretKey(KEY),
  };
}

function mockLiveblocks(room: ReturnType<typeof metadata> | "missing" = metadata()) {
  const root = { set: vi.fn() };
  const notFound = () => LiveblocksError.from(new Response("Not Found", { status: 404 }));
  const mock = {
    getRoom:
      room === "missing"
        ? vi.fn(async () => {
            throw await notFound();
          })
        : vi.fn().mockResolvedValue({ id: `preset:${ID}`, metadata: room }),
    getStorageDocument: vi.fn().mockResolvedValue({ version: 1, preset: PRESET, adoptions: {} }),
    mutateStorage: vi.fn((_id: string, callback: (ctx: { root: typeof root }) => void) => {
      callback({ root });
      return Promise.resolve();
    }),
    updateRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return { mock, root };
}

beforeEach(() => {
  vi.mocked(getLiveblocksServerClient).mockReset();
});

describe("GET /api/event-presets/[id]", () => {
  it("returns a listed preset with its summary, cached at the CDN", async () => {
    mockLiveblocks();
    const response = await GET(request("GET"), ctx());
    expect(response.status).toBe(200);
    expect(response.headers.get("cdn-cache-control")).toBe(
      "public, max-age=15, stale-while-revalidate=15",
    );
    const body = (await response.json()) as { preset: { id: string }; summary: { uses: number } };
    expect(body.preset.id).toBe(ID);
    expect(body.summary.uses).toBe(3);
    expect(JSON.stringify(body)).not.toContain(hashSecretKey(KEY));
  });

  it("404s a hidden preset, a missing one and a malformed id, without caching", async () => {
    mockLiveblocks(metadata("hidden"));
    const hidden = await GET(request("GET"), ctx());
    expect(hidden.status).toBe(404);
    expect(hidden.headers.get("cache-control")).toBe("no-store");

    mockLiveblocks("missing");
    expect((await GET(request("GET"), ctx())).status).toBe(404);
    expect((await GET(request("GET"), ctx("NOPE"))).status).toBe(404);
  });
});

describe("POST /api/event-presets/[id] (owner view)", () => {
  it("shows the owner a hidden preset and its status, never cached", async () => {
    mockLiveblocks(metadata("hidden"));
    const response = await POST(request("POST", { manageKey: KEY }), ctx());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "hidden", preset: { id: ID } });
  });

  it("403s the wrong key", async () => {
    mockLiveblocks();
    expect((await POST(request("POST", { manageKey: WRONG_KEY }), ctx())).status).toBe(403);
  });
});

describe("PUT /api/event-presets/[id] (update)", () => {
  it("403s the wrong key and changes nothing", async () => {
    const { mock } = mockLiveblocks();
    const response = await PUT(request("PUT", { manageKey: WRONG_KEY, preset: PRESET }), ctx());
    expect(response.status).toBe(403);
    expect(mock.mutateStorage).not.toHaveBeenCalled();
    expect(mock.updateRoom).not.toHaveBeenCalled();
  });

  it("updates storage and the name and rule count in metadata", async () => {
    const { mock, root } = mockLiveblocks();
    const renamed = { ...PRESET, id: "anything", name: "DMR specialist" };
    const response = await PUT(request("PUT", { manageKey: KEY, preset: renamed }), ctx());
    expect(response.status).toBe(200);
    expect(root.set).toHaveBeenCalledWith("preset", { ...renamed, id: ID });
    const [roomId, update] = mock.updateRoom.mock.calls[0] as [
      string,
      { metadata: Record<string, string> },
    ];
    expect(roomId).toBe(`preset:${ID}`);
    expect(update.metadata).toMatchObject({ name: "DMR specialist", rules: "1" });
  });

  it("keeps a hidden preset hidden", async () => {
    const { mock } = mockLiveblocks(metadata("hidden"));
    await PUT(request("PUT", { manageKey: KEY, preset: PRESET }), ctx());
    const update = (mock.updateRoom.mock.calls[0] as [string, { metadata: object }])[1].metadata;
    expect(update).not.toHaveProperty("status");
  });

  it("404s when the preset is deleted between the key check and the write", async () => {
    const { mock } = mockLiveblocks();
    mock.mutateStorage.mockRejectedValueOnce(
      await LiveblocksError.from(new Response("Not Found", { status: 404 })),
    );
    const response = await PUT(request("PUT", { manageKey: KEY, preset: PRESET }), ctx());
    expect(response.status).toBe(404);
  });

  it("runs the filter on updates too", async () => {
    const { mock } = mockLiveblocks();
    const response = await PUT(
      request("PUT", { manageKey: KEY, preset: { ...PRESET, description: "f u c k armor" } }),
      ctx(),
    );
    expect(response.status).toBe(422);
    expect(mock.mutateStorage).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/event-presets/[id] (unpublish)", () => {
  it("deletes the room with the right key", async () => {
    const { mock } = mockLiveblocks();
    const response = await DELETE(request("DELETE", { manageKey: KEY }), ctx());
    expect(response.status).toBe(200);
    expect(mock.deleteRoom).toHaveBeenCalledWith(`preset:${ID}`);
  });

  it("403s the wrong key", async () => {
    const { mock } = mockLiveblocks();
    expect((await DELETE(request("DELETE", { manageKey: WRONG_KEY }), ctx())).status).toBe(403);
    expect(mock.deleteRoom).not.toHaveBeenCalled();
  });

  it("succeeds when the preset is already gone", async () => {
    mockLiveblocks("missing");
    expect((await DELETE(request("DELETE", { manageKey: KEY }), ctx())).status).toBe(200);
  });

  it("rejects a malformed key without looking anything up", async () => {
    const { mock } = mockLiveblocks();
    expect((await DELETE(request("DELETE", { manageKey: "short" }), ctx())).status).toBe(400);
    expect(mock.getRoom).not.toHaveBeenCalled();
  });
});
