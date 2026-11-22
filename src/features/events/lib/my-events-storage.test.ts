import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetEvent,
  parseRememberedEvents,
  rememberEvent,
  renameRememberedEvent,
} from "./my-events-storage";

const KEY = "tarkovguides.events.mine.v1";
const EDIT_A = "A".repeat(43);
const EDIT_B = "B".repeat(43);

function stored() {
  return parseRememberedEvents(window.localStorage.getItem(KEY) ?? "");
}

describe("my-events-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    forgetEvent("abcdefghjk");
    forgetEvent("bcdefghjkm");
  });

  it("remembers events newest first and keeps a known name when given none", () => {
    rememberEvent({ code: "abcdefghjk", editKey: EDIT_A, name: "Duo Cup" }, 1);
    rememberEvent({ code: "bcdefghjkm", editKey: EDIT_B, name: "Solo Night" }, 2);
    rememberEvent({ code: "abcdefghjk", editKey: EDIT_A, name: "" }, 3);
    expect(stored().map((event) => [event.code, event.name])).toEqual([
      ["abcdefghjk", "Duo Cup"],
      ["bcdefghjkm", "Solo Night"],
    ]);
  });

  it("renames and forgets", () => {
    rememberEvent({ code: "abcdefghjk", editKey: EDIT_A, name: "Old" }, 1);
    renameRememberedEvent("abcdefghjk", "New");
    expect(stored()[0]?.name).toBe("New");
    forgetEvent("abcdefghjk");
    expect(stored()).toEqual([]);
  });

  it("drops malformed stored entries", () => {
    expect(
      parseRememberedEvents(
        JSON.stringify([
          { code: "abcdefghjk", editKey: EDIT_A, name: "ok", savedAt: 1 },
          { code: "bad", editKey: EDIT_A },
          { code: "bcdefghjkm", editKey: "short" },
          "junk",
        ]),
      ).map((event) => event.code),
    ).toEqual(["abcdefghjk"]);
    expect(parseRememberedEvents("{not json")).toEqual([]);
  });
});
