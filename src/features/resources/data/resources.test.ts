import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { COMMUNITY_PREVIEWS, latestCaptureMonth } from "./community-previews";
import { COMMUNITY_RESOURCES, getHostedResource, HOSTED_RESOURCES } from "./resources";

describe("HOSTED_RESOURCES", () => {
  it("uses unique kebab-case slugs", () => {
    const slugs = HOSTED_RESOURCES.map((resource) => resource.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("has a route folder for every entry", () => {
    for (const { slug } of HOSTED_RESOURCES) {
      expect(existsSync(join(process.cwd(), "src/app/resources", slug, "page.tsx")), slug).toBe(
        true,
      );
    }
  });

  it("records each checked date as YYYY-MM", () => {
    for (const resource of HOSTED_RESOURCES) {
      expect(resource.checked).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });

  it("names at least one mode when it isn't 'all'", () => {
    for (const { modes } of HOSTED_RESOURCES) {
      if (modes !== "all") expect(modes.length).toBeGreaterThan(0);
    }
  });
});

describe("getHostedResource", () => {
  it("finds an entry by slug and returns undefined for an unknown one", () => {
    expect(getHostedResource("flea-fee-calculator")?.title).toBe("Flea Fee Calculator");
    expect(getHostedResource("nope")).toBeUndefined();
  });
});

describe("COMMUNITY_RESOURCES", () => {
  it("links only to https URLs, each once, with unique ids", () => {
    const urls = COMMUNITY_RESOURCES.map((resource) => resource.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url.startsWith("https://")).toBe(true);
    const ids = COMMUNITY_RESOURCES.map((resource) => resource.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a captured preview of the same page for every site", () => {
    for (const resource of COMMUNITY_RESOURCES) {
      if (resource.group === "discords") continue;
      // Re-run scripts/capture-community-previews.mjs after adding or changing a site.
      expect(COMMUNITY_PREVIEWS[resource.id]?.url, resource.id).toBe(resource.url);
    }
  });
});

describe("COMMUNITY_PREVIEWS", () => {
  it("points at image files that exist", () => {
    for (const [id, preview] of Object.entries(COMMUNITY_PREVIEWS)) {
      expect(existsSync(join(process.cwd(), "public", preview.src)), id).toBe(true);
    }
  });

  it("only marks pages of two or more screens as scrollable", () => {
    for (const preview of Object.values(COMMUNITY_PREVIEWS)) {
      expect(preview.scroll).toBe(preview.height >= 1600);
    }
  });
});

describe("latestCaptureMonth", () => {
  it("returns the newest month, or null with no previews", () => {
    const base = { url: "", src: "", width: 1, height: 1, scroll: false };
    expect(
      latestCaptureMonth({
        a: { ...base, capturedAt: "2026-10-30" },
        b: { ...base, capturedAt: "2026-11-02" },
      }),
    ).toBe("2026-11");
    expect(latestCaptureMonth({})).toBeNull();
  });
});
