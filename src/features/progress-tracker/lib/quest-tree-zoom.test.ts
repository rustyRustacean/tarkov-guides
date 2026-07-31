import { describe, expect, it } from "vitest";

import { computeTraderJumpPan, computeWheelZoom, TRADER_JUMP_TOP_INSET } from "./quest-tree-zoom";

describe("computeWheelZoom", () => {
  it("zooms in on negative deltaY and out on positive deltaY", () => {
    const zoomIn = computeWheelZoom({
      currentZoom: 1,
      deltaY: -100,
      panX: 0,
      panY: 0,
      cursorX: 0,
      cursorY: 0,
      minZoom: 0.4,
      maxZoom: 1.5,
    });
    expect(zoomIn.zoom).toBeGreaterThan(1);

    const zoomOut = computeWheelZoom({
      currentZoom: 1,
      deltaY: 100,
      panX: 0,
      panY: 0,
      cursorX: 0,
      cursorY: 0,
      minZoom: 0.4,
      maxZoom: 1.5,
    });
    expect(zoomOut.zoom).toBeLessThan(1);
  });

  it("clamps to minZoom/maxZoom", () => {
    const clampedHigh = computeWheelZoom({
      currentZoom: 1.49,
      deltaY: -1000,
      panX: 0,
      panY: 0,
      cursorX: 0,
      cursorY: 0,
      minZoom: 0.4,
      maxZoom: 1.5,
    });
    expect(clampedHigh.zoom).toBe(1.5);

    const clampedLow = computeWheelZoom({
      currentZoom: 0.41,
      deltaY: 1000,
      panX: 0,
      panY: 0,
      cursorX: 0,
      cursorY: 0,
      minZoom: 0.4,
      maxZoom: 1.5,
    });
    expect(clampedLow.zoom).toBe(0.4);
  });

  it("keeps the content point under the cursor stationary across a zoom change", () => {
    const input = {
      currentZoom: 1,
      deltaY: -200,
      panX: -300,
      panY: -150,
      cursorX: 120,
      cursorY: 80,
      minZoom: 0.4,
      maxZoom: 1.5,
    };
    const result = computeWheelZoom(input);

    // The content-space point under the cursor before the zoom...
    const contentX = (input.cursorX - input.panX) / input.currentZoom;
    const contentY = (input.cursorY - input.panY) / input.currentZoom;

    // ...must map back to the same cursor position after applying the
    // returned zoom/pan.
    expect(contentX * result.zoom + result.panX).toBeCloseTo(input.cursorX, 10);
    expect(contentY * result.zoom + result.panY).toBeCloseTo(input.cursorY, 10);
  });

  it("is a no-op (zoom and pan unchanged) when deltaY is 0", () => {
    const result = computeWheelZoom({
      currentZoom: 0.8,
      deltaY: 0,
      panX: -200,
      panY: -50,
      cursorX: 60,
      cursorY: 40,
      minZoom: 0.4,
      maxZoom: 1.5,
    });
    expect(result.zoom).toBeCloseTo(0.8, 10);
    expect(result.panX).toBeCloseTo(-200, 10);
    expect(result.panY).toBeCloseTo(-50, 10);
  });
});

describe("computeTraderJumpPan", () => {
  it("centers the lane header horizontally in the viewport at the given zoom", () => {
    const lane = { headerX: 400, headerWidth: 220 };
    const result = computeTraderJumpPan(lane, 1000, 1);
    const laneHeaderCenterX = lane.headerX + lane.headerWidth / 2;
    expect(laneHeaderCenterX * 1 + result.x).toBeCloseTo(1000 / 2, 10);
  });

  it("accounts for the current zoom level, not just zoom 1", () => {
    const lane = { headerX: 400, headerWidth: 220 };
    const zoom = 1.5;
    const result = computeTraderJumpPan(lane, 1000, zoom);
    const laneHeaderCenterX = lane.headerX + lane.headerWidth / 2;
    expect(laneHeaderCenterX * zoom + result.x).toBeCloseTo(1000 / 2, 10);
  });

  it("always pins y to the fixed top inset, never a zoom-dependent value", () => {
    expect(computeTraderJumpPan({ headerX: 0, headerWidth: 100 }, 800, 1).y).toBe(
      TRADER_JUMP_TOP_INSET,
    );
    expect(computeTraderJumpPan({ headerX: 0, headerWidth: 100 }, 800, 2).y).toBe(
      TRADER_JUMP_TOP_INSET,
    );
  });
});
