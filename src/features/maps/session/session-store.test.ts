import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getParticipantId, useMapSessionStore } from "./session-store";

describe("useMapSessionStore", () => {
  afterEach(() => {
    useMapSessionStore.getState().clearActiveSession();
  });

  it("starts with no active session", () => {
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });

  it("setActiveSession stores the session", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({
        code: "silent-scav-42",
        roomId: "maps:silent-scav-42",
        role: "host",
        displayName: "Alice",
      });
    expect(useMapSessionStore.getState().activeSession).toEqual({
      code: "silent-scav-42",
      roomId: "maps:silent-scav-42",
      role: "host",
      displayName: "Alice",
    });
  });

  it("clearActiveSession resets to null", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "guest", displayName: "Bob" });
    useMapSessionStore.getState().clearActiveSession();
    expect(useMapSessionStore.getState().activeSession).toBeNull();
  });
});

describe("getParticipantId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("generates and persists an id on first use", () => {
    const id = getParticipantId();
    expect(id).toEqual(expect.any(String));
    expect(localStorage.getItem("tarkovguides.session.participantId")).toBe(id);
  });

  it("returns the same id on subsequent calls", () => {
    const first = getParticipantId();
    const second = getParticipantId();
    expect(second).toBe(first);
  });
});
