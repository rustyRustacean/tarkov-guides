import { LiveblocksError } from "@liveblocks/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getLiveblocksServerClient } from "../lib/liveblocks-server";

import { POST } from "./route";

vi.mock("../lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

function notFoundError(): Promise<LiveblocksError> {
  return LiveblocksError.from(new Response("Not Found", { status: 404 }));
}

function makeRequest(body: unknown, ip = "1.2.3.4"): Request {
  return new Request("https://example.com/api/maps-session/end", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockLiveblocks(overrides: Record<string, unknown> = {}) {
  const mock = {
    getRoom: vi.fn(),
    deleteRoom: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return mock;
}

describe("POST /api/maps-session/end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s on a malformed body", async () => {
    mockLiveblocks();
    const response = await POST(makeRequest({ code: "silent-scav-42" }));
    expect(response.status).toBe(400);
  });

  it("deletes the room when the caller is the host", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({ metadata: { hostParticipantId: "p1" } }),
    });
    const response = await POST(makeRequest({ code: "silent-scav-42", participantId: "p1" }));
    expect(mock.deleteRoom).toHaveBeenCalledExactlyOnceWith("maps:silent-scav-42");
    expect(response.status).toBe(200);
  });

  it("403s when the caller isn't the host", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({ metadata: { hostParticipantId: "p1" } }),
    });
    const response = await POST(makeRequest({ code: "silent-scav-42", participantId: "p2" }));
    expect(response.status).toBe(403);
    expect(mock.deleteRoom).not.toHaveBeenCalled();
  });

  it("treats an already-gone room as a successful no-op", async () => {
    mockLiveblocks({ getRoom: vi.fn().mockRejectedValue(await notFoundError()) });
    const response = await POST(makeRequest({ code: "silent-scav-42", participantId: "p1" }));
    expect(response.status).toBe(200);
  });

  it("returns a clean 500 JSON error instead of an unhandled exception when the Liveblocks client can't be constructed", async () => {
    vi.mocked(getLiveblocksServerClient).mockImplementation(() => {
      throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
    });
    const response = await POST(makeRequest({ code: "silent-scav-42", participantId: "p1" }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "server-error" });
  });
});
