import { beforeEach, describe, expect, it } from "vitest";

import { COMPANION_PROFILE_MAP_KEY } from "./companion-config";
import {
  decideProfileSync,
  readProfileMap,
  writeProfileMap,
  type CompanionIdentity,
  type SyncProfile,
} from "./use-companion-profile-sync";

const PVP_BEAR: SyncProfile = { id: "site-pvp", modes: new Map([["PVP", "BEAR"]]) };
const PVE_USEC: SyncProfile = { id: "site-pve", modes: new Map([["PVE", "USEC"]]) };

function id(overrides: Partial<CompanionIdentity> = {}): CompanionIdentity {
  return { profileId: "game-1", mode: "pvp", faction: "BEAR", ...overrides };
}

describe("decideProfileSync", () => {
  it("switches to a profile already linked to this game id", () => {
    const action = decideProfileSync(id(), [PVP_BEAR], { "game-1": "site-pvp:PVP" }, null);
    expect(action).toEqual({ kind: "switch", siteProfileId: "site-pvp", mode: "PVP" });
  });

  it("adopts an existing same-mode, same-faction profile instead of duplicating it", () => {
    const action = decideProfileSync(id(), [PVP_BEAR, PVE_USEC], {}, null);
    expect(action).toEqual({
      kind: "adopt",
      companionProfileId: "game-1",
      siteProfileId: "site-pvp",
      mode: "PVP",
    });
  });

  it("adopts by mode alone when faction is unknown", () => {
    const action = decideProfileSync(id({ faction: null }), [PVP_BEAR], {}, null);
    expect(action.kind).toBe("adopt");
  });

  it("does not adopt a profile already linked to a different game id", () => {
    const action = decideProfileSync(
      id({ profileId: "game-2" }),
      [PVP_BEAR],
      { "game-1": "site-pvp:PVP" },
      null,
    );
    expect(action.kind).toBe("create");
  });

  it("does not adopt a same-mode profile of the wrong faction", () => {
    const usecPvp: SyncProfile = { id: "site-pvp-usec", modes: new Map([["PVP", "USEC"]]) };
    const action = decideProfileSync(id({ faction: "BEAR" }), [usecPvp], {}, null);
    expect(action).toMatchObject({ kind: "create", mode: "PVP", faction: "BEAR" });
  });

  it("creates a mode-tagged profile when nothing fits", () => {
    const action = decideProfileSync(id({ mode: "pve", faction: "USEC" }), [], {}, null);
    expect(action).toEqual({
      kind: "create",
      companionProfileId: "game-1",
      name: "PvE",
      mode: "PVE",
      faction: "USEC",
    });
  });

  it("defaults a created profile to BEAR when faction is unknown", () => {
    const action = decideProfileSync(id({ faction: null }), [], {}, null);
    expect(action).toMatchObject({ kind: "create", faction: "BEAR" });
  });

  it("never folds a seasonal character into the player's real main-mode profile", () => {
    // The whole point of the season is a separate progression: adopting the
    // one profile it could reach would take over the character the player
    // actually cares about.
    const action = decideProfileSync(id({ mode: "pvp_season" }), [PVP_BEAR], {}, null);
    expect(action).toMatchObject({ kind: "add-mode", mode: "PVP_SEASONAL" });
  });

  it("creates its own Season profile when nothing can hold the seasonal mode", () => {
    const seasonalTaken: SyncProfile = {
      id: "site-szn",
      modes: new Map([["PVP_SEASONAL", "BEAR"]]),
    };
    const action = decideProfileSync(
      id({ profileId: "game-2", mode: "pvp_season" }),
      [seasonalTaken],
      { "game-1": "site-szn:PVP_SEASONAL" },
      null,
    );
    expect(action).toEqual({
      kind: "create",
      companionProfileId: "game-2",
      name: "Season",
      mode: "PVP_SEASONAL",
      faction: "BEAR",
    });
  });

  it("routes a PvE seasonal character to the seasonal bucket, not PvE", () => {
    const action = decideProfileSync(id({ mode: "pve_season", faction: "USEC" }), [], {}, null);
    expect(action).toMatchObject({ kind: "create", mode: "PVP_SEASONAL" });
  });
});

describe("profile map storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a map", () => {
    writeProfileMap({ "game-1": "site-1" });
    expect(readProfileMap()).toEqual({ "game-1": "site-1" });
  });

  it("returns an empty map for malformed storage", () => {
    localStorage.setItem(COMPANION_PROFILE_MAP_KEY, "not json");
    expect(readProfileMap()).toEqual({});
  });

  it("ignores non-string values", () => {
    localStorage.setItem(COMPANION_PROFILE_MAP_KEY, JSON.stringify({ a: "x", b: 5 }));
    expect(readProfileMap()).toEqual({ a: "x" });
  });
});
