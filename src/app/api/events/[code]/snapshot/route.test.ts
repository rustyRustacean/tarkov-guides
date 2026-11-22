import { LiveblocksError } from "@liveblocks/node";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultSettings, emptyEventDocument } from "@/features/events/lib/defaults";

import { getLiveblocksServerClient } from "../../../maps-session/lib/liveblocks-server";

import { GET } from "./route";

vi.mock("../../../maps-session/lib/liveblocks-server", () => ({
  getLiveblocksServerClient: vi.fn(),
}));

let ipCounter = 0;

function get(code: string) {
  const request = new NextRequest(`https://example.com/api/events/${code}/snapshot`, {
    headers: { "x-forwarded-for": `10.2.0.${String(++ipCounter)}` },
  });
  return GET(request, { params: Promise.resolve({ code }) });
}

describe("GET /api/events/[code]/snapshot", () => {
  beforeEach(() => {
    vi.mocked(getLiveblocksServerClient).mockReset();
  });

  it("returns the validated document without the activity log, cacheable for a few seconds", async () => {
    const stored = {
      ...emptyEventDocument(defaultSettings("Cup")),
      activity: [{ at: 1, by: "Jeff", summary: "Added team" }],
    };
    vi.mocked(getLiveblocksServerClient).mockReturnValue({
      getStorageDocument: vi.fn().mockResolvedValue(stored),
    } as never);

    const response = await get("abcdefghjk");
    expect(response.status).toBe(200);
    // Only the CDN may reuse a snapshot; browsers must revalidate every poll.
    expect(response.headers.get("cdn-cache-control")).toContain("max-age=5");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    const body = (await response.json()) as {
      document: { settings: { name: string }; activity: unknown[] };
    };
    expect(body.document.settings.name).toBe("Cup");
    expect(body.document.activity).toEqual([]);
  });

  it("404s for a malformed code without calling Liveblocks", async () => {
    const getStorageDocument = vi.fn();
    vi.mocked(getLiveblocksServerClient).mockReturnValue({ getStorageDocument } as never);
    expect((await get("NOT-A-CODE")).status).toBe(404);
    expect(getStorageDocument).not.toHaveBeenCalled();
  });

  it("404s for a deleted event and never caches errors", async () => {
    vi.mocked(getLiveblocksServerClient).mockReturnValue({
      getStorageDocument: vi.fn(async () => {
        throw await LiveblocksError.from(new Response("Not Found", { status: 404 }));
      }),
    } as never);
    const response = await get("abcdefghjk");
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("404s when the room's storage isn't a valid event", async () => {
    vi.mocked(getLiveblocksServerClient).mockReturnValue({
      getStorageDocument: vi.fn().mockResolvedValue({ junk: true }),
    } as never);
    expect((await get("abcdefghjk")).status).toBe(404);
  });
});
