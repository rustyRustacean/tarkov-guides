import { describe, expect, it } from "vitest";

import { nextControllerId, requestControlMode } from "./session-control";

describe("nextControllerId", () => {
  it("leaves the controller unchanged while they're still present", () => {
    expect(nextControllerId("host", "guest", ["host", "guest"])).toBe("guest");
  });

  it("reverts to the host once the controller disconnects", () => {
    expect(nextControllerId("host", "guest", ["host"])).toBe("host");
  });

  it("leaves the controller as-is when neither they nor the host are present", () => {
    expect(nextControllerId("host", "guest", ["someone-else"])).toBe("guest");
  });

  it("is a no-op when the host is already the controller", () => {
    expect(nextControllerId("host", "host", ["host", "guest"])).toBe("host");
  });
});

describe("requestControlMode", () => {
  it("asks the host when the host is present", () => {
    expect(requestControlMode("host", ["host", "guest"])).toBe("ask-host");
  });

  it("allows an instant claim when the host is absent", () => {
    expect(requestControlMode("host", ["guest"])).toBe("claim-instantly");
  });
});
