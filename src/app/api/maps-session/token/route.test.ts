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
  return new Request("https://example.com/api/maps-session/token", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockLiveblocks(overrides: Partial<ReturnType<typeof baseMock>> = {}) {
  const mock = { ...baseMock(), ...overrides };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return mock;
}

function baseMock() {
  return {
    getRoom: vi.fn(),
    createRoom: vi.fn().mockResolvedValue(undefined),
    mutateStorage: vi.fn().mockResolvedValue(undefined),
    prepareSession: vi.fn(() => ({
      allow: vi.fn(),
      authorize: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ token: "tok" }) }),
    })),
  };
}

describe("POST /api/maps-session/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s on a malformed body", async () => {
    mockLiveblocks();
    const response = await POST(makeRequest({ mode: "host" }));
    expect(response.status).toBe(400);
  });

  it("400s on an invalid custom code", async () => {
    mockLiveblocks();
    const response = await POST(
      makeRequest({ mode: "host", code: "ab", participantId: "p1", displayName: "Alice" }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid-code" });
  });

  it("creates a room and mints a token when hosting a fresh code", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockRejectedValue(await notFoundError()),
    });
    const response = await POST(
      makeRequest({
        mode: "host",
        code: "silent-scav-42",
        participantId: "p1",
        displayName: "Alice",
      }),
    );
    expect(mock.createRoom).toHaveBeenCalledOnce();
    expect(mock.mutateStorage).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: "tok" });
  });

  it("409s when hosting a code already taken by someone else", async () => {
    mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({ metadata: { hostParticipantId: "someone-else" } }),
    });
    const response = await POST(
      makeRequest({
        mode: "host",
        code: "silent-scav-42",
        participantId: "p1",
        displayName: "Alice",
      }),
    );
    expect(response.status).toBe(409);
  });

  it("allows the same host to re-host (reconnect) without creating a new room", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({ metadata: { hostParticipantId: "p1" } }),
    });
    const response = await POST(
      makeRequest({
        mode: "host",
        code: "silent-scav-42",
        participantId: "p1",
        displayName: "Alice",
      }),
    );
    expect(mock.createRoom).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("404s when joining a code that doesn't exist", async () => {
    mockLiveblocks({ getRoom: vi.fn().mockRejectedValue(await notFoundError()) });
    const response = await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p2",
        displayName: "Bob",
      }),
    );
    expect(response.status).toBe(404);
  });

  it("mints a token when joining an existing room", async () => {
    mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({ metadata: { hostParticipantId: "p1" } }),
    });
    const response = await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p2",
        displayName: "Bob",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: "tok" });
  });

  it("returns a clean 500 JSON error instead of an unhandled exception when the Liveblocks client can't be constructed (e.g. missing secret key)", async () => {
    vi.mocked(getLiveblocksServerClient).mockImplementation(() => {
      throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
    });
    const response = await POST(
      makeRequest({
        mode: "host",
        code: "silent-scav-42",
        participantId: "p1",
        displayName: "Alice",
      }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "server-error",
      reason: "LIVEBLOCKS_SECRET_KEY is not set",
    });
  });

  it("429s once the per-IP rate limit is exceeded", async () => {
    mockLiveblocks({ getRoom: vi.fn().mockRejectedValue(await notFoundError()) });
    const ip = "9.9.9.9";
    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await POST(
        makeRequest(
          {
            mode: "join",
            code: "silent-scav-42",
            participantId: `p${String(i)}`,
            displayName: "Bob",
          },
          ip,
        ),
      );
    }
    expect(lastResponse?.status).toBe(429);
  });
});
