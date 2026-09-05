import { describe, expect, it } from "vitest";

import {
  companionBaseMode,
  companionModeLabel,
  isSeasonalMode,
  isValidCompanionStatus,
  normalizeCompanionMode,
} from "./companion-config";

describe("normalizeCompanionMode", () => {
  it("maps the plain modes", () => {
    expect(normalizeCompanionMode("pvp")).toBe("pvp");
    expect(normalizeCompanionMode("pve")).toBe("pve");
  });

  it("treats the game's 'regular' token as PvP", () => {
    expect(normalizeCompanionMode("regular")).toBe("pvp");
  });

  it("recognizes seasonal in every spelling a companion version emits", () => {
    // A pre-2.1.8 companion forwards the game's raw token untouched.
    expect(normalizeCompanionMode("PvpSeason")).toBe("pvp_season");
    expect(normalizeCompanionMode("pvpseason")).toBe("pvp_season");
    expect(normalizeCompanionMode("pvp_season")).toBe("pvp_season");
    expect(normalizeCompanionMode("PveSeason")).toBe("pve_season");
  });

  it("returns null for anything unknown, so consumers stand down", () => {
    expect(normalizeCompanionMode("some_new_2027_mode")).toBeNull();
    expect(normalizeCompanionMode(null)).toBeNull();
    expect(normalizeCompanionMode(7)).toBeNull();
  });
});

describe("companionBaseMode / isSeasonalMode / companionModeLabel", () => {
  it("resolves the base game mode a seasonal character plays under", () => {
    expect(companionBaseMode("pvp_season")).toBe("pvp");
    expect(companionBaseMode("pve_season")).toBe("pve");
    expect(companionBaseMode("pvp")).toBe("pvp");
  });

  it("flags only the seasonal modes", () => {
    expect(isSeasonalMode("pvp_season")).toBe(true);
    expect(isSeasonalMode("pve_season")).toBe(true);
    expect(isSeasonalMode("pvp")).toBe(false);
  });

  it("labels every mode", () => {
    expect(companionModeLabel("pvp")).toBe("PvP");
    expect(companionModeLabel("pvp_season")).toBe("PvP Season");
  });
});

describe("isValidCompanionStatus", () => {
  function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      app: "MasterTarkov-Companion",
      version: "2.7.2",
      running: true,
      session: "log_x",
      gameVersion: "1.1.0.0.46624",
      mode: "pvp",
      profileId: "p1",
      faction: "BEAR",
      questsAvailable: true,
      quests: {},
      questCounts: { started: 0, finished: 0, failed: 0 },
      position: null,
      positionRevision: 0,
      raidLocation: null,
      revision: 1,
      updatedAt: 0,
      ...overrides,
    };
  }

  it("accepts a normal payload", () => {
    expect(isValidCompanionStatus(payload())).toBe(true);
  });

  it("accepts a raw seasonal mode token", () => {
    // THE regression this guards: an enumerated mode allowlist rejected the
    // entire payload, so the panel read "Not running" for the whole season.
    expect(isValidCompanionStatus(payload({ mode: "PvpSeason" }))).toBe(true);
  });

  it("still rejects a non-string mode", () => {
    expect(isValidCompanionStatus(payload({ mode: 3 }))).toBe(false);
  });

  it("accepts a companion too old to send the newer optional fields", () => {
    const old = payload();
    delete old.raidLocation;
    expect(isValidCompanionStatus(old)).toBe(true);
    expect(isValidCompanionStatus(payload({ clipSeq: undefined }))).toBe(true);
  });

  it("rejects a malformed clipSeq", () => {
    expect(isValidCompanionStatus(payload({ clipSeq: "12" }))).toBe(false);
  });
});
