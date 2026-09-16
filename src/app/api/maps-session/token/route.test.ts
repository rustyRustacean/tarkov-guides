import { LiveblocksError } from "@liveblocks/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_PARTICIPANT_COLORS } from "@/features/maps/lib/session-colors";

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
    updateRoom: vi.fn().mockResolvedValue(undefined),
    getActiveUsers: vi.fn().mockResolvedValue({ data: [] }),
    prepareSession: vi.fn(() => ({
      allow: vi.fn(),
      authorize: vi.fn().mockResolvedValue({ status: 200, body: JSON.stringify({ token: "tok" }) }),
    })),
  };
}

/** Room metadata for a session whose slots are already filled by `ids`, in order. */
function rosterMetadata(ids: readonly string[]): Record<string, string> {
  const metadata: Record<string, string> = { hostParticipantId: ids[0] ?? "" };
  ids.forEach((id, i) => {
    metadata[`slot${String(i)}`] = id;
  });
  return metadata;
}

interface MintedUserInfo {
  name: string;
  color: string;
  slot: number;
  isHost: boolean;
}

/** The `userInfo` the route handed to Liveblocks - where a participant's slot and color live. */
function mintedUserInfo(mock: ReturnType<typeof baseMock>): MintedUserInfo | undefined {
  const call = mock.prepareSession.mock.calls[0] as
    [string, { userInfo: MintedUserInfo }] | undefined;
  return call?.[1].userInfo;
}

/** The metadata the route passed to `createRoom`. */
function createdMetadata(mock: ReturnType<typeof baseMock>): Record<string, string> | undefined {
  const call = mock.createRoom.mock.calls[0] as
    [string, { metadata: Record<string, string> }] | undefined;
  return call?.[1].metadata;
}

/** The roster the route wrote back via `updateRoom`. */
function updatedMetadata(mock: ReturnType<typeof baseMock>): Record<string, string> | undefined {
  const call = mock.updateRoom.mock.calls[0] as
    [string, { metadata: Record<string, string> }] | undefined;
  return call?.[1].metadata;
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

  it("gives the host slot 0 and the first color", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockRejectedValue(await notFoundError()),
    });
    await POST(
      makeRequest({
        mode: "host",
        code: "silent-scav-42",
        participantId: "p1",
        displayName: "Alice",
      }),
    );
    expect(mintedUserInfo(mock)?.slot).toBe(0);
    expect(mintedUserInfo(mock)?.color).toBe(SESSION_PARTICIPANT_COLORS[0]);
    // Slot 0 is claimed at room-creation time so a later race can't take it.
    expect(createdMetadata(mock)).toMatchObject({ slot0: "p1" });
  });

  it("assigns joiners the next free slot, and its color, in join order", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({
        metadata: { hostParticipantId: "p1", slot0: "p1", slot1: "p2" },
      }),
    });
    await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p3",
        displayName: "Carol",
      }),
    );
    expect(mintedUserInfo(mock)?.slot).toBe(2);
    expect(mintedUserInfo(mock)?.color).toBe(SESSION_PARTICIPANT_COLORS[2]);
    expect(updatedMetadata(mock)).toMatchObject({ slot0: "p1", slot1: "p2", slot2: "p3" });
  });

  it("keeps a reconnecting participant's original slot and color", async () => {
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({
        metadata: { hostParticipantId: "p1", slot0: "p1", slot1: "p2", slot2: "p3" },
      }),
    });
    await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p2",
        displayName: "Bob",
      }),
    );
    expect(mintedUserInfo(mock)?.slot).toBe(1);
    expect(mock.updateRoom).not.toHaveBeenCalled();
  });

  it("refuses a seventh participant rather than reusing a color", async () => {
    const occupied = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({
        metadata: rosterMetadata(occupied),
      }),
      getActiveUsers: vi.fn().mockResolvedValue({ data: occupied.map((id) => ({ id })) }),
    });
    const response = await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p7",
        displayName: "Gary",
      }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: "session-full" });
    expect(mock.prepareSession).not.toHaveBeenCalled();
  });

  it("reclaims a departed participant's slot so a churned session isn't full forever", async () => {
    const occupied = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const mock = mockLiveblocks({
      getRoom: vi.fn().mockResolvedValue({
        metadata: rosterMetadata(occupied),
      }),
      // p3 (slot 2) has left.
      getActiveUsers: vi
        .fn()
        .mockResolvedValue({ data: ["p1", "p2", "p4", "p5", "p6"].map((id) => ({ id })) }),
    });
    const response = await POST(
      makeRequest({
        mode: "join",
        code: "silent-scav-42",
        participantId: "p7",
        displayName: "Gary",
      }),
    );
    expect(response.status).toBe(200);
    expect(mintedUserInfo(mock)?.slot).toBe(2);
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
