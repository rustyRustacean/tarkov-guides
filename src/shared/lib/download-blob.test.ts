import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "./download-blob";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("downloadBlob", () => {
  it("downloads the blob under the given name, then frees the object URL once it's read", () => {
    vi.useFakeTimers();
    const blob = new Blob(["hello"], { type: "text/plain" });
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });

    downloadBlob(blob, "plan.png");

    expect(create).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe("plan.png");
    expect(clicked[0]?.href).toBe("blob:mock-url");
    expect(clicked[0]?.isConnected).toBe(false);
    // iOS Safari starts the download after click() returns, so the URL must outlive it.
    expect(revoke).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:mock-url");
  });
});
