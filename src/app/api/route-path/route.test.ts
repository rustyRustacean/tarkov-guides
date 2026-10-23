import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_REQUESTS_PER_MINUTE } from "@/features/maps/lib/route-limits";
import { resetRateLimit } from "@/features/maps/server/rate-limit";
import { routeMany } from "@/features/maps/server/route-service";

import { POST } from "./route";

vi.mock("@/features/maps/server/route-service", () => ({ routeMany: vi.fn() }));

const mockedRoute = vi.mocked(routeMany);

function post(body: unknown, ip = "1.1.1.1"): Request {
  return new Request("http://localhost/api/route-path", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const good = { map: "customs", from: { x: 0, z: 0 }, to: [{ x: 10, z: 10 }] };

beforeEach(() => {
  resetRateLimit();
  mockedRoute.mockReset();
  mockedRoute.mockResolvedValue({
    routes: [null],
    stats: { refused: false, viaMesh: 0, viaGrid: 0, gridCells: 0 },
  });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/route-path", () => {
  it("answers a good request", async () => {
    const response = await POST(post(good));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ routes: [null] });
  });

  it("never passes browser-sent minefields or anchors on to the router", async () => {
    await POST(post({ ...good, minefields: [[{ x: 0, z: 0 }]], anchors: [{ x: 4999, z: 4999 }] }));
    expect(mockedRoute).toHaveBeenCalledTimes(1);
    expect(mockedRoute.mock.calls[0]).toHaveLength(3);
  });

  it("rejects points far outside any map", async () => {
    expect((await POST(post({ ...good, from: { x: 9e6, z: 0 } }))).status).toBe(400);
    expect((await POST(post({ ...good, to: [{ x: 0, z: -9e6 }] }))).status).toBe(400);
  });

  it("rejects a map with no exit path", async () => {
    expect((await POST(post({ ...good, map: "terminal" }))).status).toBe(400);
  });

  it("rejects a map with no walking data, rather than routing a straight line", async () => {
    expect((await POST(post({ ...good, map: "factory" }))).status).toBe(400);
  });

  it("makes a client that asks too often wait, without affecting others", async () => {
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i += 1) await POST(post(good, "9.9.9.9"));
    const blocked = await POST(post(good, "9.9.9.9"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await POST(post(good, "8.8.8.8"))).status).toBe(200);
  });

  it("does not leak internal error details", async () => {
    mockedRoute.mockRejectedValue(new Error("secret path C:/private/navmesh"));
    const response = await POST(post(good));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
