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
    useMapSessionStore.getState().setActiveSession({
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

describe("followHostView", () => {
  beforeEach(() => {
    localStorage.clear();
    useMapSessionStore.setState({ followHostView: true });
  });

  it("is on by default, so joining lands you on everyone else's view", () => {
    expect(useMapSessionStore.getState().followHostView).toBe(true);
  });

  it("persists an opt-out", () => {
    useMapSessionStore.getState().setFollowHostView(false);
    expect(useMapSessionStore.getState().followHostView).toBe(false);
    expect(localStorage.getItem("tarkovguides.session.followHostView")).toBe("0");
  });

  it("restores a stored opt-out on mount", () => {
    localStorage.setItem("tarkovguides.session.followHostView", "0");
    useMapSessionStore.getState().restoreFollowHostView();
    expect(useMapSessionStore.getState().followHostView).toBe(false);
  });

  it("keeps the default when nothing was ever stored", () => {
    useMapSessionStore.getState().restoreFollowHostView();
    expect(useMapSessionStore.getState().followHostView).toBe(true);
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
