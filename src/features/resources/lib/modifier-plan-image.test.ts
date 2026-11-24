import { describe, expect, it } from "vitest";

import {
  drawPlanImage,
  isPlanImageBackground,
  layoutPlanImage,
  MAX_CANVAS_PIXELS,
  pickScale,
  wrapText,
  type DrawOp,
  type PlanImageContext,
  type PlanImageInput,
  type PlanImageModifier,
} from "./modifier-plan-image";

/** 10 px per character, whatever the font, so layouts are predictable. */
const measure = (text: string) => text.length * 10;
const FONTS = { display: "Display", body: "Body" };

function modifier(name: string, points: number, effects = ["Does a thing"]): PlanImageModifier {
  return { name, points, effects, icon: `/images/seasonal-modifiers/${name}.png` };
}

function input(overrides: Partial<PlanImageInput> = {}): PlanImageInput {
  return {
    title: "Untar Control",
    subtitle: "Season 2 modifier plan",
    positive: [modifier("Average", -8)],
    negative: [modifier("No Flea Market", 11)],
    points: { gained: 11, spent: 8, balance: 3 },
    status: { text: "Plan works", tone: "green" },
    clashes: [],
    footer: "tarkovguides.com/resources/seasonal-modifier-planner#s=2&p=AAAAEAAAIA",
    note: "Values may change.",
    ...overrides,
  };
}

function texts(ops: readonly DrawOp[]): string[] {
  return ops.flatMap((op) => (op.kind === "text" ? [op.text] : []));
}

function iconX(ops: readonly DrawOp[], name: string): number | undefined {
  return ops.find((op) => op.kind === "image" && op.src.includes(name))?.x;
}

describe("wrapText", () => {
  it("wraps text at the measured width", () => {
    expect(wrapText("aaa bbb ccc", 75, measure)).toEqual(["aaa bbb", "ccc"]);
  });

  it("breaks a word longer than the line", () => {
    expect(wrapText("abcdefghij", 45, measure)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("returns no lines for empty text", () => {
    expect(wrapText("", 100, measure)).toEqual([]);
  });
});

describe("layoutPlanImage", () => {
  it("lays positive picks left and negative picks right", () => {
    const { width, ops } = layoutPlanImage(input(), measure, FONTS);

    const left = iconX(ops, "Average");
    const right = iconX(ops, "No Flea Market");
    expect(left).toBeDefined();
    expect(right).toBeGreaterThan(width / 2);
    expect(left).toBeLessThan(width / 2);
  });

  it("grows the height with the tallest column", () => {
    const one = layoutPlanImage(input(), measure, FONTS).height;
    const four = layoutPlanImage(
      input({ positive: ["A", "B", "C", "D"].map((name) => modifier(name, -1)) }),
      measure,
      FONTS,
    ).height;
    const longEffects = layoutPlanImage(
      input({ positive: [modifier("Average", -8, ["word ".repeat(200)])] }),
      measure,
      FONTS,
    ).height;

    expect(four).toBeGreaterThan(one);
    expect(longEffects).toBeGreaterThan(one);
  });

  it("names each pick with its points, as on BSG's cards", () => {
    const { ops } = layoutPlanImage(input(), measure, FONTS);

    expect(texts(ops)).toContain("AVERAGE (-8)");
    expect(texts(ops)).toContain("NO FLEA MARKET (+11)");
  });

  it("shows the balance, status, clashes and footer", () => {
    const { ops } = layoutPlanImage(
      input({ clashes: ["Average and Prodigy (Season 1)"] }),
      measure,
      FONTS,
    );

    expect(texts(ops)).toEqual(
      expect.arrayContaining([
        "Balance 3",
        "Plan works",
        "Average and Prodigy (Season 1)",
        "tarkovguides.com/resources/seasonal-modifier-planner#s=2&p=AAAAEAAAIA",
        "Values may change.",
      ]),
    );
  });

  it("writes zero points plainly, like the side panel", () => {
    const { ops } = layoutPlanImage(
      input({ positive: [], points: { gained: 11, spent: 0, balance: 11 } }),
      measure,
      FONTS,
    );

    expect(texts(ops)).toContain("Gained +11   Spent 0");
  });

  it("says when a column has nothing picked", () => {
    const { ops } = layoutPlanImage(input({ negative: [] }), measure, FONTS);

    expect(texts(ops)).toContain("Nothing picked");
  });
});

describe("isPlanImageBackground", () => {
  it("accepts the background color, nudged a little the way Brave's default mode does", () => {
    expect(isPlanImageBackground([26, 26, 28, 255])).toBe(true);
    expect(isPlanImageBackground([27, 25, 29, 255])).toBe(true);
  });

  // A real readback from a browser that blocks canvas reads (random colors, random alpha).
  it("rejects what a canvas-blocking browser hands back", () => {
    expect(isPlanImageBackground([153, 219, 150, 60])).toBe(false);
    expect(isPlanImageBackground([1, 131, 212, 230])).toBe(false);
    expect(isPlanImageBackground([0, 0, 0, 0])).toBe(false);
    expect(isPlanImageBackground([255, 255, 255, 255])).toBe(false);
  });
});

describe("pickScale", () => {
  it("draws at 2x while the canvas stays under iOS Safari's size limit", () => {
    expect(pickScale(1200, 1500)).toBe(2);
  });

  it("scales a very tall plan down just enough to fit the limit", () => {
    const scale = pickScale(1200, 8000);

    expect(scale).toBeLessThan(2);
    expect(scale).toBeGreaterThan(1);
    expect(Math.ceil(1200 * scale) * Math.ceil(8000 * scale)).toBeLessThanOrEqual(
      MAX_CANVAS_PIXELS,
    );
  });
});

describe("drawPlanImage", () => {
  it("draws ops onto a context in order, skipping icons that didn't load", () => {
    const calls: string[] = [];
    const ctx: PlanImageContext = {
      fillStyle: "",
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: (x, y, w, h) =>
        calls.push(`fillRect ${String(x)},${String(y)},${String(w)},${String(h)}`),
      beginPath: () => calls.push("beginPath"),
      roundRect: () => calls.push("roundRect"),
      fill: () => calls.push("fill"),
      fillText: (text) => calls.push(`fillText ${text}`),
      drawImage: () => calls.push("drawImage"),
    };
    const icon = { source: {} as CanvasImageSource, width: 96, height: 96 };
    const ops: DrawOp[] = [
      { kind: "rect", x: 0, y: 0, width: 10, height: 10, color: "#111", radius: 4 },
      { kind: "image", x: 1, y: 1, size: 8, src: "/a.png" },
      { kind: "image", x: 1, y: 1, size: 8, src: "/missing.png" },
      { kind: "text", x: 2, y: 2, text: "Hi", font: "16px Body", color: "#fff", align: "left" },
    ];

    drawPlanImage(ctx, { width: 100, height: 50, ops }, new Map([["/a.png", icon]]));

    expect(calls).toEqual([
      "fillRect 0,0,100,50",
      "beginPath",
      "roundRect",
      "fill",
      "drawImage",
      "fillText Hi",
    ]);
    expect(ctx.textBaseline).toBe("top");
  });
});
