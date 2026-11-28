import { beforeEach, describe, expect, it, vi } from "vitest";

import { isManageKey, isPublicPresetId } from "@/features/events/lib/public-presets";

import { hashSecretKey } from "../lib/secrets";
import { getLiveblocksServerClient } from "../maps-session/lib/liveblocks-server";

import { GET, POST } from "./route";

import type { RoomData } from "@liveblocks/node";

vi.mock("../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

let ipCounter = 0;

function publishRequest(body: unknown, ip = `10.2.0.${String(++ipCounter)}`): Request {
  return new Request("https://example.com/api/event-presets", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function listRequest(): Request {
  return new Request("https://example.com/api/event-presets", {
    headers: { "x-forwarded-for": `10.3.0.${String(++ipCounter)}` },
  });
}

const PRESET = {
  id: "local-1",
  name: "Bolt-action specialist",
  description: "No body armor",
  rules: [{ id: "r1", kind: "ban", target: { type: "category", id: "body-armor" } }],
};

function presetRoom(id: string, name: string, uses: number, status = "listed"): RoomData {
  return {
    type: "room",
    id: `preset:${id}`,
    createdAt: new Date(0),
    organizationId: "org",
    defaultAccesses: [],
    usersAccesses: {},
    groupsAccesses: {},
    metadata: {
      kind: "preset",
      status,
      name,
      uses: String(uses),
      rules: "1",
      publishedAt: "2026-11-27T00:00:00.000Z",
      manageKeyHash: "f".repeat(64),
    },
  };
}

function mockLiveblocks(rooms: RoomData[] = []) {
  const mock = {
    createRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    initializeStorageDocument: vi.fn().mockResolvedValue(undefined),
    iterRooms: vi.fn(async function* () {
      await Promise.resolve();
      yield* rooms;
    }),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return { mock };
}

describe("POST /api/event-presets (publish)", () => {
  beforeEach(() => {
    vi.mocked(getLiveblocksServerClient).mockReset();
  });

  it("publishes into a locked room and returns the manage key once", async () => {
    const { mock } = mockLiveblocks();
    const response = await POST(publishRequest({ preset: PRESET }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { id, manageKey } = (await response.json()) as { id: string; manageKey: string };
    expect(isPublicPresetId(id)).toBe(true);
    expect(isManageKey(manageKey)).toBe(true);

    const [roomId, options] = mock.createRoom.mock.calls[0] as [
      string,
      { defaultAccesses: unknown[]; metadata: Record<string, string> },
    ];
    expect(roomId).toBe(`preset:${id}`);
    expect(options.defaultAccesses).toEqual([]);
    expect(options.metadata).toMatchObject({
      kind: "preset",
      status: "listed",
      name: "Bolt-action specialist",
      rules: "1",
      uses: "0",
    });

    // Storage is just the preset, under its public id: nothing that grows with use.
    expect(mock.initializeStorageDocument).toHaveBeenCalledWith(`preset:${id}`, {
      liveblocksType: "LiveObject",
      data: { version: 1, preset: { ...PRESET, id } },
    });
  });

  it("stores only the key's hash", async () => {
    const { mock } = mockLiveblocks();
    const response = await POST(publishRequest({ preset: PRESET }));
    const { manageKey } = (await response.json()) as { manageKey: string };
    const metadata = (mock.createRoom.mock.calls[0] as [string, { metadata: object }])[1].metadata;
    expect(metadata).toMatchObject({ manageKeyHash: hashSecretKey(manageKey) });
    expect(JSON.stringify(metadata)).not.toContain(manageKey);
  });

  it("rejects filtered text with 422 naming the field, and creates nothing", async () => {
    const { mock } = mockLiveblocks();
    const response = await POST(publishRequest({ preset: { ...PRESET, name: "sh1t kit" } }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: "blocked-text", field: "name" });
    expect(mock.createRoom).not.toHaveBeenCalled();
  });

  it("rejects a preset with no name, a malformed body and an oversized one", async () => {
    const { mock } = mockLiveblocks();
    expect((await POST(publishRequest({ preset: { ...PRESET, name: "" } }))).status).toBe(400);
    expect((await POST(publishRequest("just a string"))).status).toBe(400);
    const huge = { preset: { ...PRESET, description: "x".repeat(70_000) } };
    expect((await POST(publishRequest(huge))).status).toBe(413);
    expect(mock.createRoom).not.toHaveBeenCalled();
  });

  it("deletes the room when seeding fails", async () => {
    const { mock } = mockLiveblocks();
    mock.initializeStorageDocument.mockRejectedValueOnce(new Error("boom"));
    expect((await POST(publishRequest({ preset: PRESET }))).status).toBe(500);
    expect(mock.deleteRoom).toHaveBeenCalledTimes(1);
  });

  it("rate limits publishing per IP", async () => {
    mockLiveblocks();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await POST(publishRequest({ preset: PRESET }, "9.9.9.8"))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("doesn't count rejected attempts against the publish limit", async () => {
    mockLiveblocks();
    for (let i = 0; i < 6; i++) {
      const blocked = await POST(
        publishRequest({ preset: { ...PRESET, name: "sh1t" } }, "9.9.9.7"),
      );
      expect(blocked.status).toBe(422);
    }
    expect((await POST(publishRequest({ preset: PRESET }, "9.9.9.7"))).status).toBe(200);
  });
});

describe("GET /api/event-presets (list)", () => {
  beforeEach(() => {
    vi.mocked(getLiveblocksServerClient).mockReset();
  });

  it("lists only listed presets, most used first, then by name", async () => {
    const { mock } = mockLiveblocks([
      presetRoom("aaaaaaaaab", "Zulu", 1),
      presetRoom("aaaaaaaaac", "Alpha", 1),
      presetRoom("aaaaaaaaad", "Hidden one", 9, "hidden"),
      presetRoom("aaaaaaaaae", "Popular", 7),
    ]);
    const response = await GET(listRequest());
    expect(response.status).toBe(200);
    const { presets } = (await response.json()) as { presets: { id: string }[] };
    expect(presets.map((preset) => preset.id)).toEqual(["aaaaaaaaae", "aaaaaaaaac", "aaaaaaaaab"]);
    expect(mock.iterRooms).toHaveBeenCalledWith(
      { query: { metadata: { kind: "preset", status: "listed" } } },
      { pageSize: 100 },
    );
  });

  it("never sends the manage key's hash", async () => {
    mockLiveblocks([presetRoom("aaaaaaaaab", "Zulu", 1)]);
    const body = await (await GET(listRequest())).text();
    expect(body).not.toContain("f".repeat(64));
  });

  it("lets the CDN cache the list while browsers revalidate", async () => {
    mockLiveblocks([]);
    const response = await GET(listRequest());
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("cdn-cache-control")).toBe(
      "public, max-age=30, stale-while-revalidate=30",
    );
  });

  it("fails without caching when Liveblocks is down", async () => {
    const { mock } = mockLiveblocks();
    mock.iterRooms.mockImplementation(async function* () {
      await Promise.resolve();
      yield* [];
      throw new Error("down");
    });
    const response = await GET(listRequest());
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
