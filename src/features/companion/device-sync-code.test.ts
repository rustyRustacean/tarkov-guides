import { describe, expect, it } from "vitest";

import { roomIdForCode } from "@/features/maps/lib/session-code";

import { syncRoomIdForCode } from "./device-sync-code";

describe("syncRoomIdForCode", () => {
  it("namespaces device-sync rooms under `sync:`", () => {
    expect(syncRoomIdForCode("silent-scav-42")).toBe("sync:silent-scav-42");
  });

  it("normalizes free-typed input the same way map codes do", () => {
    expect(syncRoomIdForCode("  Silent Scav 42 ")).toBe("sync:silent-scav-42");
  });

  it("never collides with a maps Collaborate room using the identical code", () => {
    const code = "silent-scav-42";
    expect(syncRoomIdForCode(code)).not.toBe(roomIdForCode(code));
    expect(roomIdForCode(code)).toBe("maps:silent-scav-42");
  });
});
