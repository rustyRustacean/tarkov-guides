import { describe, expect, it } from "vitest";

import {
  generateCustomMapId,
  isImageFile,
  MAX_CUSTOM_MAP_IMAGE_BYTES,
  readFileAsDataUrl,
} from "./custom-map-upload";

describe("generateCustomMapId", () => {
  it("starts with the custom- prefix", () => {
    expect(generateCustomMapId()).toMatch(/^custom-[a-z0-9]+-[a-z0-9]+$/);
  });

  it("produces distinct ids across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateCustomMapId()));
    expect(ids.size).toBe(20);
  });
});

describe("isImageFile", () => {
  it("returns true for an image MIME type", () => {
    expect(isImageFile({ type: "image/png" })).toBe(true);
    expect(isImageFile({ type: "image/jpeg" })).toBe(true);
  });

  it("returns false for a non-image MIME type", () => {
    expect(isImageFile({ type: "application/json" })).toBe(false);
    expect(isImageFile({ type: "" })).toBe(false);
  });
});

describe("MAX_CUSTOM_MAP_IMAGE_BYTES", () => {
  it("is 15MB", () => {
    expect(MAX_CUSTOM_MAP_IMAGE_BYTES).toBe(15 * 1024 * 1024);
  });
});

describe("readFileAsDataUrl", () => {
  it("resolves the file's contents as a data URL", async () => {
    const file = new File(["hello"], "test.png", { type: "image/png" });
    await expect(readFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });
});
