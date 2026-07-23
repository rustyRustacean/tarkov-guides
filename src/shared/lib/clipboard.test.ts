/* eslint-disable @typescript-eslint/no-deprecated -- this file specifically exercises the deprecated `document.execCommand` fallback path */
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "./clipboard";

describe("copyToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error -- restoring the jsdom-provided clipboard after a test replaces it
    delete navigator.clipboard;
  });

  it("uses navigator.clipboard.writeText when available and resolves true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("falls back to execCommand when navigator.clipboard.writeText rejects", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
  });

  it("falls back to execCommand when navigator.clipboard is absent", async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledExactlyOnceWith("copy");
  });

  it("resolves false when every path fails", async () => {
    document.execCommand = vi.fn(() => {
      throw new Error("nope");
    });

    await expect(copyToClipboard("hello")).resolves.toBe(false);
  });
});
