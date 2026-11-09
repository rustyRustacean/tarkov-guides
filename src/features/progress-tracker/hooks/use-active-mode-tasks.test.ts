import { describe, expect, it } from "vitest";

import { tasksForMode } from "./use-active-mode-tasks";

import type { NormalizedTask, TarkovGameData } from "@/shared/lib/tarkov-api/types";

const task = (id: string) => ({ id }) as unknown as NormalizedTask;

const DATA: TarkovGameData = {
  tasks: [task("regular")],
  tasksPve: [task("pve")],
  tasksSeason: [task("season")],
  hideoutStations: [],
  items: [],
  traders: [],
  barters: [],
  crafts: [],
  maps: [],
  mobs: [],
};

describe("tasksForMode", () => {
  it("gives each mode its own task list", () => {
    expect(tasksForMode(DATA, "PVP").map((t) => t.id)).toEqual(["regular"]);
    expect(tasksForMode(DATA, "PVE").map((t) => t.id)).toEqual(["pve"]);
    // Seasonal used to borrow the regular list; it has its own feed now.
    expect(tasksForMode(DATA, "PVP_SEASONAL").map((t) => t.id)).toEqual(["season"]);
  });
});
