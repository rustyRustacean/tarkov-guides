import { describe, expect, it } from "vitest";

import { rotateExit } from "./exit-rotate";

import type { AppliedExit } from "./exit-snip";

function exit(kind: AppliedExit["kind"], id: string, unknown = false): AppliedExit {
  return { kind, id, name: id, position: { x: 0, y: 0, z: 0 }, unknown, match: "exact" };
}

const list = [
  exit("exfil", "a"),
  exit("exfil", "b", true),
  exit("exfil", "c"),
  exit("transit", "t1"),
  exit("transit", "t2"),
];

describe("rotateExit", () => {
  it("starts at the first when nothing is selected, and the last going back", () => {
    expect(rotateExit(list, null, "exfil", 1)?.id).toBe("a");
    expect(rotateExit(list, null, "exfil", -1)?.id).toBe("c");
  });

  it("steps through exits of one kind and wraps, skipping unknown ones", () => {
    expect(rotateExit(list, "exfil:a", "exfil", 1)?.id).toBe("c");
    expect(rotateExit(list, "exfil:c", "exfil", 1)?.id).toBe("a");
    expect(rotateExit(list, "exfil:a", "exfil", -1)?.id).toBe("c");
  });

  it("does not mix kinds", () => {
    expect(rotateExit(list, "exfil:a", "transit", 1)?.id).toBe("t1");
    expect(rotateExit(list, "transit:t2", "transit", 1)?.id).toBe("t1");
  });

  it("falls back to unknown exits when nothing else of that kind exists", () => {
    const only = [exit("exfil", "x", true)];
    expect(rotateExit(only, null, "exfil", 1)?.id).toBe("x");
  });

  it("returns null with nothing to rotate", () => {
    expect(rotateExit([], null, "exfil", 1)).toBeNull();
    expect(rotateExit(list, null, "exfil", 0)).toBeNull();
  });
});
