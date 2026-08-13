import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWikiGuideData, wikiSlugFromLink } from "./fetch-wiki";

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

/** A `<li class="gallerybox">` in Fandom's current gallery markup: a `.thumb` wrapping the image, plus a *sibling* `.gallerytext` caption (not a descendant of `.thumb`). */
function gallerybox(dataSrc: string, caption: string): string {
  return `<li class="gallerybox"><div class="thumb"><span><a href="${dataSrc}"><img data-src="${dataSrc}" src="placeholder.gif"></a></span></div><div class="gallerytext">${caption}</div></li>`;
}

describe("fetchWikiGuideData", () => {
  it("returns empty text and images for a page with no Guide/Walkthrough/Strategy section", async () => {
    mockWikiHtml(`<div class="mw-parser-output"><h2>Objectives</h2><p>obj</p></div>`);
    const data = await fetchWikiGuideData("Slug");
    expect(data).toEqual({ text: "", images: [] });
  });

  it("collects only the paragraphs/lists under the Guide heading, not earlier or later h2 sections", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2>Objectives</h2><p>obj text</p>
        <h2><span class="mw-headline">Guide</span></h2><p>Step one.</p><ul><li>a bullet step</li></ul>
        <h2>Rewards</h2><p>reward text</p>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.text).toBe("Step one.\n\na bullet step");
    expect(data.images).toEqual([]);
  });

  it("keeps collecting through <h3>/<h4> subsections instead of stopping at the first one - only another <h2> ends the Guide section", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2><span class="mw-headline">Guide</span></h2>
        <p>Find the machine gun and the launcher.</p>
        <h3><span class="mw-headline">Utyos</span></h3>
        <p>Located on the third floor.</p>
        <h4><span class="mw-headline">Even deeper</span></h4>
        <p>Behind the desk.</p>
        <h3><span class="mw-headline">AGS</span></h3>
        <p>Located in the back office.</p>
        <h2>Rewards</h2><p>reward text</p>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.text).toBe(
      [
        "Find the machine gun and the launcher.",
        "Utyos",
        "Located on the third floor.",
        "Even deeper",
        "Behind the desk.",
        "AGS",
        "Located in the back office.",
      ].join("\n\n"),
    );
  });

  it("extracts full-res image src and caption from the current <li class=gallerybox> markup, including map screenshots", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2><span class="mw-headline">Guide</span></h2>
        <p>intro</p>
        <ul class="gallery mw-gallery-packed">
          ${gallerybox("https://cdn/map.png/revision/latest/scale-to-width-down/300?cb=1", "Location marked on map")}
          ${gallerybox("https://cdn/shot.png/revision/latest/scale-to-width-down/300?cb=2", "Objective spot")}
        </ul>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.images).toEqual([
      { src: "https://cdn/map.png/revision/latest?cb=1", caption: "Location marked on map" },
      { src: "https://cdn/shot.png/revision/latest?cb=2", caption: "Objective spot" },
    ]);
  });

  it("tags each image with the nearest preceding <h3>/<h4> as section, leaving pre-subsection images untagged", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2><span class="mw-headline">Guide</span></h2>
        <ul class="gallery">${gallerybox("https://cdn/overview.png", "Overview")}</ul>
        <h3><span class="mw-headline">Utyos</span></h3>
        <ul class="gallery">${gallerybox("https://cdn/a.png", "A")}</ul>
        <h3><span class="mw-headline">AGS</span></h3>
        <ul class="gallery">${gallerybox("https://cdn/b.png", "B")}</ul>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.images).toEqual([
      { src: "https://cdn/overview.png", caption: "Overview" },
      { src: "https://cdn/a.png", caption: "A", section: "Utyos" },
      { src: "https://cdn/b.png", caption: "B", section: "AGS" },
    ]);
  });

  it("dedupes an identical image src shared across two subsections, keeping the first occurrence's section", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2><span class="mw-headline">Guide</span></h2>
        <h3><span class="mw-headline">Utyos</span></h3>
        <ul class="gallery">
          ${gallerybox("https://cdn/map.png", "Location marked on map")}
          ${gallerybox("https://cdn/a.png", "A")}
        </ul>
        <h3><span class="mw-headline">AGS</span></h3>
        <ul class="gallery">
          ${gallerybox("https://cdn/map.png", "Location marked on map")}
          ${gallerybox("https://cdn/b.png", "B")}
        </ul>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.images).toEqual([
      { src: "https://cdn/map.png", caption: "Location marked on map", section: "Utyos" },
      { src: "https://cdn/a.png", caption: "A", section: "Utyos" },
      { src: "https://cdn/b.png", caption: "B", section: "AGS" },
    ]);
  });

  it("falls back to the anchor href when no data-src/srcset is present", async () => {
    mockWikiHtml(
      `<div class="mw-parser-output">
        <h2><span class="mw-headline">Guide</span></h2>
        <ul class="gallery"><li class="gallerybox"><div class="thumb"><a href="https://cdn/from-anchor.png"><img src="placeholder.gif"></a></div><div class="gallerytext">Caption</div></li></ul>
      </div>`,
    );
    const data = await fetchWikiGuideData("Slug");
    expect(data.images).toEqual([{ src: "https://cdn/from-anchor.png", caption: "Caption" }]);
  });

  it("returns empty for a fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );
    expect(await fetchWikiGuideData("Slug")).toEqual({ text: "", images: [] });
  });

  it("returns empty for an empty slug without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await fetchWikiGuideData("")).toEqual({ text: "", images: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
