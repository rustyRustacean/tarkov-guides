import { describe, expect, it } from "vitest";

import { isSameOriginJsonRequest } from "./same-origin";

function request(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/x", { method: "POST", headers, body: "{}" });
}

describe("isSameOriginJsonRequest", () => {
  it("accepts a same-origin JSON request", () => {
    expect(
      isSameOriginJsonRequest(
        request({ "content-type": "application/json", "sec-fetch-site": "same-origin" }),
      ),
    ).toBe(true);
    expect(
      isSameOriginJsonRequest(request({ "content-type": "application/json; charset=utf-8" })),
    ).toBe(true);
  });

  it("rejects cross-site and same-site requests", () => {
    for (const site of ["cross-site", "same-site"]) {
      expect(
        isSameOriginJsonRequest(
          request({ "content-type": "application/json", "sec-fetch-site": site }),
        ),
        site,
      ).toBe(false);
    }
  });

  it("rejects bodies a cross-site form or no-cors fetch can send without a preflight", () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data"]) {
      expect(isSameOriginJsonRequest(request({ "content-type": type })), type).toBe(false);
    }
    expect(isSameOriginJsonRequest(request({}))).toBe(false);
  });
});
