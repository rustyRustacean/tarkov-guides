import { afterEach, describe, expect, it, vi } from "vitest";

import { openProfileRequestUrl, shouldTriggerSnip, tarkovDevPlayerUrl } from "./use-killer-lookup";

describe("tarkovDevPlayerUrl", () => {
  it("uses tarkov.dev's own mode names - PvP is 'regular' on their routes", () => {
    expect(tarkovDevPlayerUrl("103968", "pvp")).toBe("https://tarkov.dev/players/regular/103968");
    expect(tarkovDevPlayerUrl("103968", "pve")).toBe("https://tarkov.dev/players/pve/103968");
  });

  it("opens a seasonal killer on the SEASON tab, not the regular one", () => {
    // Stats are per mode: a seasonal character's kills aren't in `regular`,
    // so the wrong tab shows the wrong numbers (or an empty profile).
    expect(tarkovDevPlayerUrl("7", "pvp_season")).toBe("https://tarkov.dev/players/pvp-season/7");
  });

  it("sends PvE-seasonal to the PvE tab, which is the only real one for it", () => {
    // tarkov.dev's seasonal toggle is PvP-only - there is no pve-season tab.
    expect(tarkovDevPlayerUrl("7", "pve_season")).toBe("https://tarkov.dev/players/pve/7");
  });

  it("falls back to the SEASON tab when the mode is unknown", () => {
    // The user's call: during a season, that's what they're playing, so an
    // unknown mode (no raid seen yet, old companion, new game token) is
    // likelier to be seasonal than regular.
    expect(tarkovDevPlayerUrl("7", null)).toBe("https://tarkov.dev/players/pvp-season/7");
  });
});

describe("openProfileRequestUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks the companion by account id and mode - never by URL", () => {
    // The endpoint accepts no address by design: the companion builds the
    // tarkov.dev link itself, so this request can only ever open a profile.
    const asked = openProfileRequestUrl(47800, "4956780", "pvp");
    expect(asked).toBe("http://127.0.0.1:47800/open-profile?id=4956780&mode=regular");
    expect(asked).not.toContain("tarkov.dev");
  });

  it("asks for the same tab the site would have opened, seasonal included", () => {
    expect(openProfileRequestUrl(47801, "7", "pvp_season")).toBe(
      "http://127.0.0.1:47801/open-profile?id=7&mode=pvp-season",
    );
    expect(openProfileRequestUrl(47801, "7", "pve_season")).toBe(
      "http://127.0.0.1:47801/open-profile?id=7&mode=pve",
    );
    expect(openProfileRequestUrl(47800, "a b&c", null)).toBe(
      "http://127.0.0.1:47800/open-profile?id=a%20b%26c&mode=pvp-season",
    );
  });
});

describe("shouldTriggerSnip", () => {
  it("treats the first observation as a baseline, never a trigger", () => {
    // Whatever was on the clipboard when the option came on predates it.
    expect(shouldTriggerSnip(null, 41)).toEqual({ baseline: 41, fire: false });
  });

  it("fires only when the counter moves", () => {
    expect(shouldTriggerSnip(41, 41)).toEqual({ baseline: 41, fire: false });
    expect(shouldTriggerSnip(41, 42)).toEqual({ baseline: 42, fire: true });
  });

  it("never fires against a companion too old to report the counter", () => {
    expect(shouldTriggerSnip(null, undefined)).toEqual({ baseline: null, fire: false });
    // And a counter that disappears (companion downgraded mid-session) resets
    // the baseline rather than firing on whatever number comes back later.
    expect(shouldTriggerSnip(41, undefined)).toEqual({ baseline: null, fire: false });
  });
});
