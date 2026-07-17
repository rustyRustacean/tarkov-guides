import { describe, expect, it } from "vitest";

import {
  CLOSED_PX,
  clampSheetHeight,
  computeSnapDecision,
  OPEN_FRACTION,
  restingHeightPx,
} from "./sheet-drag";

describe("restingHeightPx", () => {
  it("returns CLOSED_PX when closed", () => {
    expect(restingHeightPx(false, 1000)).toBe(CLOSED_PX);
  });

  it("returns OPEN_FRACTION of the container height when open", () => {
    expect(restingHeightPx(true, 1000)).toBe(Math.round(1000 * OPEN_FRACTION));
  });
});

describe("clampSheetHeight", () => {
  it("clamps below CLOSED_PX up to CLOSED_PX", () => {
    expect(clampSheetHeight(0, 1000)).toBe(CLOSED_PX);
    expect(clampSheetHeight(-50, 1000)).toBe(CLOSED_PX);
  });

  it("clamps above MAX_FRACTION of the container down to that limit", () => {
    expect(clampSheetHeight(10_000, 1000)).toBe(900);
  });

  it("passes through an in-range value unchanged", () => {
    expect(clampSheetHeight(500, 1000)).toBe(500);
  });
});

describe("computeSnapDecision", () => {
  it("treats movement under the tap threshold as a tap, toggling the prior state", () => {
    expect(
      computeSnapDecision({
        movedPx: 3,
        velocityPxPerMs: 0,
        currentBottomPx: 46,
        containerHeightPx: 1000,
        currentlyOpen: false,
      }),
    ).toBe(true);
    expect(
      computeSnapDecision({
        movedPx: 3,
        velocityPxPerMs: 0,
        currentBottomPx: 700,
        containerHeightPx: 1000,
        currentlyOpen: true,
      }),
    ).toBe(false);
  });

  it("a fast upward flick forces open regardless of release position", () => {
    expect(
      computeSnapDecision({
        movedPx: 50,
        velocityPxPerMs: -0.5,
        currentBottomPx: 100,
        containerHeightPx: 1000,
        currentlyOpen: false,
      }),
    ).toBe(true);
  });

  it("a fast downward flick forces closed regardless of release position", () => {
    expect(
      computeSnapDecision({
        movedPx: 50,
        velocityPxPerMs: 0.5,
        currentBottomPx: 900,
        containerHeightPx: 1000,
        currentlyOpen: true,
      }),
    ).toBe(false);
  });

  it("a slow drag released past the height fraction snaps open", () => {
    expect(
      computeSnapDecision({
        movedPx: 50,
        velocityPxPerMs: 0.1,
        currentBottomPx: 400,
        containerHeightPx: 1000,
        currentlyOpen: false,
      }),
    ).toBe(true);
  });

  it("a slow drag released below the height fraction snaps closed", () => {
    expect(
      computeSnapDecision({
        movedPx: 50,
        velocityPxPerMs: 0.1,
        currentBottomPx: 300,
        containerHeightPx: 1000,
        currentlyOpen: true,
      }),
    ).toBe(false);
  });

  it("velocity exactly at the snap threshold does not force open/closed (falls through to height check)", () => {
    expect(
      computeSnapDecision({
        movedPx: 50,
        velocityPxPerMs: -0.35,
        currentBottomPx: 100,
        containerHeightPx: 1000,
        currentlyOpen: false,
      }),
    ).toBe(false);
  });
});
