import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /companion/source", () => {
  it("serves the real companion script as readable text", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    // text/plain is the whole point: as application/octet-stream (which is how
    // a .ps1 is served straight out of public/) the browser downloads it
    // instead of showing it.
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

    const body = await response.text();
    // Reads the same file the download zip is built from, so this asserts
    // against the real script rather than a copy that could drift.
    expect(body).toContain("MasterTarkov Companion");
    expect(body).toContain("$COMPANION_VERSION");
  });
});
