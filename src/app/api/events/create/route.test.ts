import { LiveblocksError } from "@liveblocks/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings, emptyEventDocument } from "@/features/events/lib/defaults";
import { isEditKey, isEventCode } from "@/features/events/lib/event-code";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { hashSecretKey } from "../lib/event-keys";

import { POST } from "./route";

vi.mock("../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

let ipCounter = 0;

function makeRequest(body: unknown, ip = `10.0.0.${String(++ipCounter)}`): Request {
  return new Request("https://example.com/api/events/create", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockLiveblocks() {
  const root = { set: vi.fn() };
  const mock = {
    createRoom: vi.fn().mockResolvedValue(undefined),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    mutateStorage: vi.fn((_id: string, callback: (ctx: { root: typeof root }) => void) => {
      callback({ root });
      return Promise.resolve();
    }),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return { mock, root };
}

describe("POST /api/events/create", () => {
  beforeEach(() => {
    vi.mocked(getLiveblocksServerClient).mockReset();
  });

  it("creates a locked room, stores only the key's hash, and seeds storage", async () => {
    const { mock, root } = mockLiveblocks();
    const document = emptyEventDocument(defaultSettings("Duo Cup", ["PVP", "PVE"], 2));
    const response = await POST(makeRequest({ document }));
    expect(response.status).toBe(200);
    const { code, editKey } = (await response.json()) as { code: string; editKey: string };
    expect(isEventCode(code)).toBe(true);
    expect(isEditKey(editKey)).toBe(true);

    const [roomId, options] = mock.createRoom.mock.calls[0] as [
      string,
      { defaultAccesses: unknown[]; metadata: Record<string, string> },
    ];
    expect(roomId).toBe(`events:${code}`);
    expect(options.defaultAccesses).toEqual([]);
    expect(options.metadata.editKeyHash).toBe(hashSecretKey(editKey));
    expect(JSON.stringify(options.metadata)).not.toContain(editKey);

    const keys = root.set.mock.calls.map(([key]) => key as string);
    expect(keys).toEqual([
      "version",
      "settings",
      "columns",
      "teams",
      "entries",
      "adjustments",
      "presets",
      "activity",
    ]);
  });

  it("rejects a document with no modes", async () => {
    const { mock } = mockLiveblocks();
    const document = emptyEventDocument({ ...defaultSettings("Bad"), modes: [] });
    const response = await POST(makeRequest({ document }));
    expect(response.status).toBe(400);
    expect(mock.createRoom).not.toHaveBeenCalled();
  });

  it("retries on a code collision", async () => {
    const { mock } = mockLiveblocks();
    mock.createRoom
      .mockRejectedValueOnce(await LiveblocksError.from(new Response("Conflict", { status: 409 })))
      .mockResolvedValue(undefined);
    const response = await POST(
      makeRequest({ document: emptyEventDocument(defaultSettings("Retry")) }),
    );
    expect(response.status).toBe(200);
    expect(mock.createRoom).toHaveBeenCalledTimes(2);
  });

  it("deletes the room when seeding fails", async () => {
    const { mock } = mockLiveblocks();
    mock.mutateStorage.mockRejectedValueOnce(new Error("boom"));
    const response = await POST(
      makeRequest({ document: emptyEventDocument(defaultSettings("Fail")) }),
    );
    expect(response.status).toBe(500);
    expect(mock.deleteRoom).toHaveBeenCalledTimes(1);
  });

  it("rate limits creation per IP", async () => {
    mockLiveblocks();
    const body = { document: emptyEventDocument(defaultSettings("Spam")) };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await POST(makeRequest(body, "9.9.9.9"))).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
