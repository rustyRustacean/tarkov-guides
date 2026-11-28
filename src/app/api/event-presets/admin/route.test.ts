import { LiveblocksError } from "@liveblocks/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";

import { POST } from "./route";

import type { RoomData } from "@liveblocks/node";

vi.mock("../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

const ADMIN_KEY = "A".repeat(43);
const ID = "abcdefghjk";
const REPORTERS = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
let ipCounter = 0;

const PRESET = {
  id: ID,
  name: "Bolt-action specialist",
  description: "",
  rules: [{ id: "r1", kind: "ban", target: { type: "category", id: "body-armor" } }],
};

function admin(body: Record<string, unknown>, ip = `10.6.0.${String(++ipCounter)}`) {
  return new Request("https://example.com/api/event-presets/admin", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify({ adminKey: ADMIN_KEY, ...body }),
  });
}

function room(status: string, id = ID): RoomData {
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
      name: PRESET.name,
      uses: "2",
      rules: "1",
      publishedAt: "2026-11-27T00:00:00.000Z",
      manageKeyHash: "f".repeat(64),
      reporters: REPORTERS,
    },
  };
}

function mockLiveblocks(stored: RoomData | "missing" = room("hidden")) {
  const mock = {
    getRoom: vi.fn(async () => {
      if (stored === "missing") {
        throw await LiveblocksError.from(new Response("Not Found", { status: 404 }));
      }
      return stored;
    }),
    getStorageDocument: vi.fn().mockResolvedValue({ version: 1, preset: PRESET }),
    iterRooms: vi.fn(async function* () {
      await Promise.resolve();
      if (stored !== "missing") yield stored;
    }),
    updateRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return mock;
}

beforeEach(() => {
  vi.mocked(getLiveblocksServerClient).mockReset();
  vi.stubEnv("EVENTS_ADMIN_KEY", ADMIN_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/event-presets/admin", () => {
  it("refuses everything when the admin key is unset or too short", async () => {
    const mock = mockLiveblocks();
    for (const value of ["", "short"]) {
      vi.stubEnv("EVENTS_ADMIN_KEY", value);
      const response = await POST(admin({ action: "list", adminKey: value }));
      expect(response.status).toBe(503);
    }
    expect(mock.iterRooms).not.toHaveBeenCalled();
  });

  it("403s a wrong key and does nothing", async () => {
    const mock = mockLiveblocks();
    const response = await POST(admin({ action: "delete", id: ID, adminKey: "B".repeat(43) }));
    expect(response.status).toBe(403);
    expect(mock.deleteRoom).not.toHaveBeenCalled();
  });

  it("lists hidden presets with their report counts, never the reporter hashes", async () => {
    const mock = mockLiveblocks();
    const response = await POST(admin({ action: "list" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({
      hidden: [expect.objectContaining({ id: ID, name: PRESET.name, reports: 3 })],
    });
    expect(body).not.toContain("a".repeat(64));
    expect(mock.iterRooms).toHaveBeenCalledWith(
      { query: { metadata: { kind: "preset", status: "hidden" } } },
      { pageSize: 100 },
    );
  });

  it("shows any preset's content for review, hidden or not", async () => {
    mockLiveblocks();
    const response = await POST(admin({ action: "view", id: ID }));
    expect(await response.json()).toMatchObject({
      status: "hidden",
      reports: 3,
      preset: { id: ID, name: PRESET.name },
    });
  });

  it("restores a hidden preset: listed again, reports cleared", async () => {
    const mock = mockLiveblocks();
    const response = await POST(admin({ action: "restore", id: ID }));
    expect(response.status).toBe(200);
    expect(mock.updateRoom).toHaveBeenCalledWith(`preset:${ID}`, {
      metadata: { status: "listed", reporters: null },
    });
  });

  it("hides a listed preset", async () => {
    const mock = mockLiveblocks(room("listed"));
    await POST(admin({ action: "hide", id: ID }));
    expect(mock.updateRoom).toHaveBeenCalledWith(`preset:${ID}`, {
      metadata: { status: "hidden" },
    });
  });

  it("deletes a preset", async () => {
    const mock = mockLiveblocks(room("listed"));
    const response = await POST(admin({ action: "delete", id: ID }));
    expect(response.status).toBe(200);
    expect(mock.deleteRoom).toHaveBeenCalledWith(`preset:${ID}`);
  });

  it("404s an action on a missing preset, and 400s an unknown action or id", async () => {
    mockLiveblocks("missing");
    expect((await POST(admin({ action: "restore", id: ID }))).status).toBe(404);
    expect((await POST(admin({ action: "explode", id: ID }))).status).toBe(400);
    expect((await POST(admin({ action: "delete", id: "NOPE" }))).status).toBe(400);
  });

  it("lets the right key work through a long review queue", async () => {
    mockLiveblocks();
    const statuses: number[] = [];
    for (let i = 0; i < 40; i++) {
      statuses.push((await POST(admin({ action: "list" }, "198.51.100.50"))).status);
    }
    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it("rate limits every call per IP, right key or not, at 120 per 10 minutes", async () => {
    mockLiveblocks();
    const wrong = { action: "list", adminKey: "B".repeat(43) };
    for (let i = 0; i < 120; i++) await POST(admin(wrong, "198.51.100.51"));
    expect((await POST(admin({ action: "list" }, "198.51.100.51"))).status).toBe(429);
  });

  it("still lists a hidden preset whose metadata is malformed, by id", async () => {
    mockLiveblocks({ ...room("hidden"), metadata: { ...room("hidden").metadata, name: "" } });
    const body = (await (await POST(admin({ action: "list" }))).json()) as {
      hidden: { id: string; reports: number }[];
    };
    expect(body.hidden).toEqual([expect.objectContaining({ id: ID, name: "", reports: 3 })]);
  });
});
