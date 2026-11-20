import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
  it("links only to https URLs, each once", () => {
    const urls = COMMUNITY_RESOURCES.map((resource) => resource.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) expect(url.startsWith("https://")).toBe(true);
  });
});
