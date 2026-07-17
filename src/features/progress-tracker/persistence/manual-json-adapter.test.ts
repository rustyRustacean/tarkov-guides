import { describe, expect, it, vi } from "vitest";

import { emptyProfileProgress } from "../types";

import { manualJsonAdapter, readJsonFile } from "./manual-json-adapter";
import { serializeSnapshot } from "./serialize";

import type { ProgressTrackerSnapshot } from "./types";

function makeSnapshot(): ProgressTrackerSnapshot {
  return serializeSnapshot({
    profiles: [{ id: "p1", name: "PMC", mode: "PVP", faction: "BEAR", face: null }],
    activeProfileId: "p1",
    progressByProfile: { p1: emptyProfileProgress() },
    autoStartNext: true,
  });
}

describe("readJsonFile", () => {
  it("parses and validates a well-formed snapshot file", async () => {
    const snapshot = makeSnapshot();
    const file = new File([JSON.stringify(snapshot)], "backup.json", { type: "application/json" });
    await expect(readJsonFile(file)).resolves.toEqual(snapshot);
  });

  it("resolves null (never throws/rejects) for malformed JSON", async () => {
    const file = new File(["{not valid json"], "backup.json", { type: "application/json" });
    await expect(readJsonFile(file)).resolves.toBeNull();
  });

  it("resolves null for valid JSON that doesn't match the snapshot shape", async () => {
    const file = new File([JSON.stringify({ hello: "world" })], "backup.json", {
      type: "application/json",
    });
    await expect(readJsonFile(file)).resolves.toBeNull();
  });
});

describe("manualJsonAdapter", () => {
  it("isAvailable is true in a browser-like (jsdom) environment", () => {
    expect(manualJsonAdapter.isAvailable()).toBe(true);
  });

  describe("write()", () => {
    it("triggers a download via a temporary <a download> with a date-stamped filename, then revokes the object URL", async () => {
      const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => undefined);
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => undefined);

      await manualJsonAdapter.write(makeSnapshot());

      expect(createObjectURLSpy).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
    });
  });

  describe("read()", () => {
    it("resolves null if the user cancels the file picker (no file selected)", async () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
        this: HTMLInputElement,
      ) {
        this.dispatchEvent(new Event("change"));
      });
      await expect(manualJsonAdapter.read()).resolves.toBeNull();
      clickSpy.mockRestore();
    });
  });
});
