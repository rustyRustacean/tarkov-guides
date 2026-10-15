import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useExitSnipStore } from "@/features/maps/exit-snip-store";

import { handleExitSnip } from "./exit-snip-flow";

import type { CompanionStatus } from "./companion-config";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/shared/ui/toast/toast-store", () => ({ toast: toastMock }));

const SHORELINE: RawMap = {
  name: "Shoreline",
  normalizedName: "shoreline",
  nameId: "Shoreline",
  raidDuration: null,
  players: null,
  bosses: [],
  extracts: [
    { id: "s-tu", name: "Tunnel", faction: "pmc", position: { x: 1, y: 0, z: 2 } },
    { id: "s-pi", name: "Pier Boat", faction: "pmc", position: { x: 3, y: 0, z: 4 } },
    { id: "s-no", name: "Road to North V-Ex", faction: "pmc", position: { x: 5, y: 0, z: 6 } },
  ],
  transits: [],
};

function status(overrides: Partial<CompanionStatus> = {}): CompanionStatus {
  return {
    capabilities: ["exitSnip"],
    raidLocation: "Shoreline",
    inRaid: true,
    died: false,
    ...overrides,
  } as CompanionStatus;
}

const EXIT_ROWS = [
  { kind: "exfil", index: 1, name: "Road to North V-Ex", hasTimer: false },
  { kind: "exfil", index: 2, name: "Tunnel", hasTimer: false },
  { kind: "exfil", index: 3, name: "Pier Boat", hasTimer: true },
];

interface Call {
  url: string;
}

function mockCompanion(exits: unknown): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      calls.push({ url });
      if (url.includes("/exits")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(exits) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }),
  );
  return calls;
}

describe("handleExitSnip", () => {
  beforeEach(() => {
    useExitSnipStore.getState().clear();
    toastMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies a matching exit list, reports the snip used, and marks the unknown exit", async () => {
    const calls = mockCompanion({ ok: true, kind: "exit-list", rows: EXIT_ROWS, snipId: "abc123" });

    const result = await handleExitSnip(status(), [SHORELINE]);

    expect(result).toBe("handled");
    const applied = useExitSnipStore.getState().snip;
    expect(applied?.nameId).toBe("Shoreline");
    expect(applied?.exits.map((e) => [e.name, e.unknown])).toEqual([
      ["Road to North V-Ex", false],
      ["Tunnel", false],
      ["Pier Boat", true],
    ]);
    // The snip is reported used - the one thing that lets the companion delete it.
    expect(calls.some((c) => c.url.includes("/snip/confirm?id=abc123&matched=1"))).toBe(true);
  });

  it("refuses a list that doesn't fit the map the game says, keeps the snip, changes nothing", async () => {
    const calls = mockCompanion({
      ok: true,
      kind: "exit-list",
      rows: [{ kind: "exfil", index: 1, name: "Cellars", hasTimer: false }],
      snipId: "zzz",
    });

    await handleExitSnip(status(), [SHORELINE]);

    expect(useExitSnipStore.getState().snip).toBeNull();
    expect(calls.some((c) => c.url.includes("/snip/confirm?id=zzz&matched=0"))).toBe(true);
    expect(toastMock).toHaveBeenCalled();
  });

  it("passes a non-exit-list image on to the next handler without touching anything", async () => {
    const calls = mockCompanion({ ok: true, kind: "other" });

    const result = await handleExitSnip(status(), [SHORELINE]);

    expect(result).toBe("other");
    expect(useExitSnipStore.getState().snip).toBeNull();
    expect(calls.every((c) => !c.url.includes("/snip/confirm"))).toBe(true);
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("stays out of the way of a companion that has no /exits", async () => {
    const calls = mockCompanion({ ok: true, kind: "exit-list", rows: EXIT_ROWS });

    const result = await handleExitSnip(status({ capabilities: ["clipboardSnip"] }), [SHORELINE]);

    expect(result).toBe("other");
    expect(calls).toHaveLength(0);
  });

  it("keeps the snip and asks for a retry while map data is still loading", async () => {
    const calls = mockCompanion({ ok: true, kind: "exit-list", rows: EXIT_ROWS, snipId: "late" });

    await handleExitSnip(status(), []);

    expect(useExitSnipStore.getState().snip).toBeNull();
    expect(calls.some((c) => c.url.includes("/snip/confirm?id=late&matched=0"))).toBe(true);
  });
});
