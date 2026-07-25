import { beforeEach, describe, expect, it } from "vitest";

import { useGameDataBannerStore } from "./game-data-banner-store";

describe("game data banner store", () => {
  beforeEach(() => {
    useGameDataBannerStore.setState({ dismissedAt: 0 });
  });

  it("defaults to never dismissed", () => {
    expect(useGameDataBannerStore.getState().dismissedAt).toBe(0);
  });

  it("dismiss records the current time", () => {
    const before = Date.now();
    useGameDataBannerStore.getState().dismiss();
    expect(useGameDataBannerStore.getState().dismissedAt).toBeGreaterThanOrEqual(before);
  });
});
