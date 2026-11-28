import { LiveblocksError } from "@liveblocks/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";

import { POST } from "./route";

vi.mock("../../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

const ID = "abcdefghjk";
const SECRET = "r".repeat(43);
let ipCounter = 0;

/** A report from `ip`; `null` sends no `x-forwarded-for` at all. */
function report(
  ip: string | null = `10.5.0.${String(++ipCounter)}`,
  headers: Record<string, string> = {},
) {
  return new Request(`https://example.com/api/event-presets/${ID}/report`, {
    method: "POST",
    headers: {
      ...(ip === null ? {} : { "x-forwarded-for": ip }),
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
    body: "{}",
  });
}

function ctx(id = ID) {
  return { params: Promise.resolve({ id }) };
}

/** A fake preset room whose metadata `updateRoom` really changes, like Liveblocks would. */
function mockLiveblocks(initial: Record<string, string | string[]> | "missing") {
  const metadata: Record<string, string | string[]> =
    initial === "missing" ? {} : { kind: "preset", status: "listed", name: "Kit", ...initial };
  const mock = {
    getRoom: vi.fn(async () => {
      if (initial === "missing") {
        throw await LiveblocksError.from(new Response("Not Found", { status: 404 }));
      }
      return { id: `preset:${ID}`, metadata: { ...metadata } };
    }),
    updateRoom: vi.fn((_id: string, update: { metadata: Record<string, string | string[]> }) => {
      Object.assign(metadata, update.metadata);
      return Promise.resolve();
    }),
  };
  vi.mocked(getLiveblocksServerClient).mockReturnValue(mock as never);
  return { mock, metadata };
}

beforeEach(() => {
  vi.mocked(getLiveblocksServerClient).mockReset();
  vi.stubEnv("EVENTS_REPORT_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/event-presets/[id]/report", () => {
  it("hides a preset once three distinct IPs report it", async () => {
    const { metadata } = mockLiveblocks({});
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      expect((await POST(report(ip), ctx())).status).toBe(200);
      expect(metadata.status).toBe("listed");
    }
    expect((await POST(report("198.51.100.3"), ctx())).status).toBe(200);
    expect(metadata.status).toBe("hidden");
    expect(metadata.reporters).toHaveLength(3);
  });

  it("counts one IP once, however many times it reports", async () => {
    const { metadata } = mockLiveblocks({});
    for (let i = 0; i < 3; i++) await POST(report("198.51.100.9"), ctx());
    expect(metadata.reporters).toHaveLength(1);
    expect(metadata.status).toBe("listed");
  });

  it("stores an HMAC of the IP, never the IP itself", async () => {
    const { metadata } = mockLiveblocks({});
    await POST(report("198.51.100.77"), ctx());
    const stored = JSON.stringify(metadata);
    expect(stored).not.toContain("198.51.100.77");
    expect(metadata.reporters).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
  });

  it("answers the same whether or not the report changed anything", async () => {
    mockLiveblocks({});
    const first = await POST(report("198.51.100.30"), ctx());
    const repeat = await POST(report("198.51.100.30"), ctx());
    expect(await first.json()).toEqual({ reported: true });
    expect(await repeat.json()).toEqual({ reported: true });
  });

  it("treats a hidden preset like a missing one, as the public page does", async () => {
    const { mock } = mockLiveblocks({ status: "hidden" });
    expect((await POST(report(), ctx())).status).toBe(404);
    expect(mock.updateRoom).not.toHaveBeenCalled();
  });

  it("doesn't count a report that carries no client IP", async () => {
    const { mock } = mockLiveblocks({});
    expect((await POST(report(null), ctx())).status).toBe(200);
    expect((await POST(report(""), ctx())).status).toBe(200);
    expect(mock.updateRoom).not.toHaveBeenCalled();
  });

  it("rejects cross-site and non-JSON requests without touching the room", async () => {
    const { mock } = mockLiveblocks({});
    expect((await POST(report(undefined, { "sec-fetch-site": "cross-site" }), ctx())).status).toBe(
      403,
    );
    expect((await POST(report(undefined, { "content-type": "text/plain" }), ctx())).status).toBe(
      403,
    );
    expect(mock.getRoom).not.toHaveBeenCalled();
  });

  it("is unavailable when the report secret is unset or too short", async () => {
    const { mock } = mockLiveblocks({});
    vi.stubEnv("EVENTS_REPORT_SECRET", "");
    expect((await POST(report(), ctx())).status).toBe(503);
    vi.stubEnv("EVENTS_REPORT_SECRET", "short");
    expect((await POST(report(), ctx())).status).toBe(503);
    expect(mock.updateRoom).not.toHaveBeenCalled();
  });

  it("404s a missing preset and a malformed id", async () => {
    mockLiveblocks("missing");
    expect((await POST(report(), ctx())).status).toBe(404);
    expect((await POST(report(), ctx("NOPE"))).status).toBe(404);
  });

  it("rate limits reports per IP", async () => {
    mockLiveblocks({});
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++)
      statuses.push((await POST(report("198.51.100.200"), ctx())).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
