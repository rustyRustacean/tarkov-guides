import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWikiGuideText, fetchWikiImages, wikiSlugFromLink, wikiThumbUrl } from "./fetch-wiki";

function mockWikiHtml(html: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ parse: { text: { "*": html } } }),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wikiSlugFromLink", () => {
  it("takes the decoded last path segment of a wiki link", () => {
    expect(
      wikiSlugFromLink("https://escapefromtarkov.fandom.com/wiki/The_Bunker_-_Part_1", "x"),
    ).toBe("The_Bunker_-_Part_1");
    expect(wikiSlugFromLink("https://x/wiki/Ice_Cream_Cones%20", "x")).toBe("Ice_Cream_Cones ");
  });

  it("falls back to the underscored task name when there is no link", () => {
    expect(wikiSlugFromLink(null, "Search Mission")).toBe("Search_Mission");
  });
});

describe("fetchWikiGuideText", () => {
  it("returns only the paragraphs/lists under a Guide/Walkthrough heading", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2>Objectives</h2><p>obj text</p>
        <h2>Guide</h2><p>Step one.</p><ul><li>a bullet step</li></ul>
        <h2>Rewards</h2><p>reward text</p>
      </div>`,
    );
    expect(await fetchWikiGuideText("Slug")).toBe("Step one.\n\na bullet step");
  });

  it("returns empty for a page with no Guide section", async () => {
    mockWikiHtml(`<div class="mw-parser-output"><h2>Objectives</h2><p>obj</p></div>`);
    expect(await fetchWikiGuideText("Slug")).toBe("");
  });
});

describe("wikiThumbUrl", () => {
  it("scales a canonical fandom URL, keeping its cache-buster query", () => {
    expect(wikiThumbUrl("https://cdn/images/a/ab/Shot.png/revision/latest?cb=123", 480)).toBe(
      "https://cdn/images/a/ab/Shot.png/revision/latest/scale-to-width-down/480?cb=123",
    );
  });

  it("scales a URL with no query", () => {
    expect(wikiThumbUrl("https://cdn/images/a/ab/Shot.png/revision/latest", 480)).toBe(
      "https://cdn/images/a/ab/Shot.png/revision/latest/scale-to-width-down/480",
    );
  });

  it("passes through a URL that takes no scaling suffix", () => {
    expect(wikiThumbUrl("https://cdn/images/a/ab/Shot.png", 480)).toBe(
      "https://cdn/images/a/ab/Shot.png",
    );
  });
});

describe("fetchWikiImages", () => {
  it("extracts full-res screenshot URLs, skipping map-captioned images", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <figure class="thumb"><a href="x"><img data-src="https://cdn/thumb/shot.png/scale-to-width-down/300"></a><figcaption class="thumbcaption">Objective spot</figcaption></figure>
        <figure class="thumb"><img data-src="https://cdn/map.png"><figcaption class="thumbcaption">Map with markers</figcaption></figure>
      </div>`,
    );
    const images = await fetchWikiImages("Slug");
    expect(images).toEqual([{ url: "https://cdn/shot.png", caption: "Objective spot" }]);
  });
});
