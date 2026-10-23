import { describe, expect, it } from "vitest";

import {
  chooseTarget,
  exitKey,
  pointInPolygon,
  polygonRouter,
  routeAround,
  type Point,
} from "./exit-path";

import type { AppliedExit } from "./exit-snip";

/** An axis-aligned square minefield centred on (cx, cz). */
function square(cx: number, cz: number, half: number): Point[] {
  return [
    { x: cx - half, z: cz - half },
    { x: cx + half, z: cz - half },
    { x: cx + half, z: cz + half },
    { x: cx - half, z: cz + half },
  ];
}

function exit(id: string, x: number, z: number, overrides: Partial<AppliedExit> = {}): AppliedExit {
  return {
    kind: "exfil",
    id,
    name: id,
    position: { x, y: 0, z },
    unknown: false,
    match: "exact",
    ...overrides,
  };
}

describe("pointInPolygon", () => {
  it("tells inside from outside", () => {
    const poly = square(0, 0, 5);
    expect(pointInPolygon({ x: 0, z: 0 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 9, z: 0 }, poly)).toBe(false);
  });
});

describe("routeAround", () => {
  it("is a straight line when nothing is in the way", () => {
    const route = routeAround({ x: 0, z: 0 }, { x: 100, z: 0 }, [square(50, 40, 5)]);
    expect(route.detoured).toBe(false);
    expect(route.points).toHaveLength(2);
    expect(route.length).toBeCloseTo(100);
  });

  it("bends around a minefield that sits on the line, and never crosses it", () => {
    const mine = square(50, 0, 10);
    const route = routeAround({ x: 0, z: 0 }, { x: 100, z: 0 }, [mine]);
    expect(route.detoured).toBe(true);
    expect(route.length).toBeGreaterThan(100);
    // Every leg stays out of the minefield: sample along each segment.
    for (let i = 0; i < route.points.length - 1; i += 1) {
      const a = route.points[i];
      const b = route.points[i + 1];
      if (!a || !b) continue;
      for (let t = 0; t <= 1; t += 0.05) {
        const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
        expect(pointInPolygon(p, mine)).toBe(false);
      }
    }
  });

  it("detours around several minefields in a row", () => {
    const route = routeAround({ x: 0, z: 0 }, { x: 200, z: 0 }, [
      square(50, 0, 10),
      square(120, 0, 12),
    ]);
    expect(route.detoured).toBe(true);
    expect(route.points.length).toBeGreaterThan(3);
  });

  it("ignores a minefield the start is already inside", () => {
    const route = routeAround({ x: 50, z: 0 }, { x: 100, z: 0 }, [square(50, 0, 10)]);
    expect(route.detoured).toBe(false);
    expect(route.length).toBeCloseTo(50);
  });

  it("ignores a minefield that contains the exit", () => {
    const route = routeAround({ x: 0, z: 0 }, { x: 100, z: 0 }, [square(100, 0, 10)]);
    expect(route.detoured).toBe(false);
  });
});

describe("chooseTarget", () => {
  const from = { x: 0, z: 0 };

  it("picks the closest available extract", () => {
    const target = chooseTarget(
      [exit("far", 100, 0), exit("near", 20, 0)],
      null,
      polygonRouter(from, []),
    );
    expect(target?.exit.id).toBe("near");
    expect(target?.reason).toBe("closest");
  });

  it("skips ??? exits and transits when choosing on its own", () => {
    const target = chooseTarget(
      [
        exit("unknown-near", 5, 0, { unknown: true }),
        exit("transit-near", 8, 0, { kind: "transit" }),
        exit("real", 60, 0),
      ],
      null,
      polygonRouter(from, []),
    );
    expect(target?.exit.id).toBe("real");
  });

  it("goes to the selected exit even if it is ???", () => {
    const unknown = exit("unknown-near", 5, 0, { unknown: true });
    const target = chooseTarget(
      [unknown, exit("real", 60, 0)],
      exitKey(unknown),
      polygonRouter(from, []),
    );
    expect(target?.exit.id).toBe("unknown-near");
    expect(target?.reason).toBe("selected");
  });

  it("uses route length, so a minefield can change which exit is closest", () => {
    const wall = square(30, 0, 20);
    const blocked = exit("blocked", 60, 0);
    const clear = exit("clear", 0, 70);
    const target = chooseTarget([blocked, clear], null, polygonRouter(from, [wall]));
    // Straight-line 60 vs 70, but the detour pushes "blocked" past "clear".
    expect(target?.exit.id).toBe("clear");
  });

  it("returns null when no exit is available", () => {
    expect(
      chooseTarget([exit("u", 5, 0, { unknown: true })], null, polygonRouter(from, [])),
    ).toBeNull();
    expect(chooseTarget([], null, polygonRouter(from, []))).toBeNull();
  });

  it("ignores exits with no position", () => {
    const noPos: AppliedExit = { ...exit("n", 0, 0), position: null };
    expect(chooseTarget([noPos], null, polygonRouter(from, []))).toBeNull();
  });
});
