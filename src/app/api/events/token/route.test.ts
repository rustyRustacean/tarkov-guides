import { LiveblocksError } from "@liveblocks/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLiveblocksServerClient } from "../../maps-session/lib/liveblocks-server";
import { hashSecretKey } from "../lib/event-keys";

import { POST } from "./route";

vi.mock("../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

const CODE = "abcdefghjk";
const KEY = "A".repeat(43);
let ipCounter = 0;

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.com/api/events/token", {
    method: "POST",
    headers: { "x-forwarded-for": `10.1.0.${String(++ipCounter)}` },
    body: JSON.stringify({ code: CODE, editKey: KEY, participantId: "participant-1", ...body }),
  });
}

function mockLiveblocks(metadata: Record<string, string> | "missing") {
  const allow = vi.fn();
  const mock = {
    getRoom:
      metadata === "missing"
        ? vi.fn(async () => {
            throw await LiveblocksError.from(new Response("Not Found", { status: 404 }));
          })
        : vi.fn().mockResolvedValue({ metadata }),
    prepareSession: vi.fn(() => ({
      allow,
      authorize: vi.fn().mockResolvedValue({ status: 200, body: '{"token":"t"}' }),
    })),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return { mock, allow };
}

describe("POST /api/events/token", () => {
  beforeEach(() => {
    vi.mocked(getLiveblocksServerClient).mockReset();
  });

  it("grants write access for the right edit key", async () => {
    const { mock, allow } = mockLiveblocks({ kind: "event", editKeyHash: hashSecretKey(KEY) });
    const response = await POST(makeRequest({ displayName: "  Jeff​ " }));
    expect(response.status).toBe(200);
    expect(allow).toHaveBeenCalledWith(`events:${CODE}`, ["room:write"]);
    expect(mock.prepareSession).toHaveBeenCalledWith("participant-1", {
      userInfo: { name: "Jeff" },
    });
  });

  it("refuses a wrong edit key", async () => {
    const { allow } = mockLiveblocks({ kind: "event", editKeyHash: hashSecretKey("B".repeat(43)) });
    const response = await POST(makeRequest({}));
    expect(response.status).toBe(403);
    expect(allow).not.toHaveBeenCalled();
  });

  it("refuses a room that isn't an event", async () => {
    mockLiveblocks({ kind: "other", editKeyHash: hashSecretKey(KEY) });
    expect((await POST(makeRequest({}))).status).toBe(404);
  });

  it("reports a deleted event as not found", async () => {
    mockLiveblocks("missing");
    expect((await POST(makeRequest({}))).status).toBe(404);
  });

  it("rejects malformed codes and keys before calling Liveblocks", async () => {
    const { mock } = mockLiveblocks({ kind: "event", editKeyHash: hashSecretKey(KEY) });
    expect((await POST(makeRequest({ code: "short" }))).status).toBe(400);
    expect((await POST(makeRequest({ editKey: "nope" }))).status).toBe(400);
    expect(mock.getRoom).not.toHaveBeenCalled();
  });
});
