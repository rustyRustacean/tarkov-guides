import { describe, expect, it } from "vitest";

import { getFullResolutionImageUrl, QUEST_GUIDE_IMAGES } from "./quest-guide-images";

describe("getFullResolutionImageUrl", () => {
  it("strips the scale-to-width-down segment, keeping the cache-buster query string", () => {
    expect(
      getFullResolutionImageUrl(
        "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/dc/Shooting_Cans_Map.png/revision/latest/scale-to-width-down/311?cb=20240325032754",
      ),
    ).toBe(
      "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/d/dc/Shooting_Cans_Map.png/revision/latest?cb=20240325032754",
    );
  });

  it("returns the url unchanged when it doesn't match the scaled-thumbnail pattern", () => {
    const url = "https://example.com/some/other/image.png";
    expect(getFullResolutionImageUrl(url)).toBe(url);
  });

  it("resolves every curated QUEST_GUIDE_IMAGES entry to a distinct, non-scaled url", () => {
    for (const images of Object.values(QUEST_GUIDE_IMAGES)) {
      for (const image of images) {
        const fullRes = getFullResolutionImageUrl(image.src);
        expect(fullRes).not.toBe(image.src);
        expect(fullRes).not.toMatch(/scale-to-width-down/);
      }
    }
  });
});
