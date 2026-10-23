import { describe, expect, it } from "vitest";

import { describePath } from "./ExitPathControls";

import type { ExitPathView } from "../hooks/use-exit-path";

function viewWith(status: ExitPathView["status"]): ExitPathView {
  return {
    status,
    start: null,
    startSource: null,
    listed: [],
    others: [],
    target: null,
    routing: false,
  };
}

describe("describePath", () => {
  it("says nothing while Go to Exit is off", () => {
    expect(describePath(viewWith("off"))).toBeNull();
  });

  it("asks for a snip when there are no exits yet, without mentioning a test button", () => {
    expect(describePath(viewWith("no-exits"))).toBe("Snip the exit list first.");
  });

  it("asks for an in-raid screenshot when there is no position", () => {
    expect(describePath(viewWith("no-position"))).toBe(
      "Needs a position: take an in-raid screenshot.",
    );
  });

  it("says when it is still finding the route", () => {
    expect(describePath({ ...viewWith("ready"), routing: true })).toBe("Finding the route...");
  });
});
