import { describe, expect, it } from "vitest";

import { preparePresetForPublishing, presetStatus, readSummary } from "./preset-rooms";

import type { RoomData } from "@liveblocks/node";

const ID = "abcdefghjk";

function room(metadata: Record<string, string | string[]>, id = `preset:${ID}`): RoomData {
  return {
    type: "room",
    id,
    createdAt: new Date(0),
    organizationId: "org",
    defaultAccesses: [],
    usersAccesses: {},
    groupsAccesses: {},
    metadata,
  };
}

const LISTED = {
  kind: "preset",
  status: "listed",
  name: "Bolt-action specialist",
  uses: "4",
  rules: "3",
  publishedAt: "2026-11-27T12:00:00.000Z",
};

describe("readSummary", () => {
  it("reads a listed preset's metadata", () => {
    expect(readSummary(room(LISTED))).toEqual({
      id: ID,
      name: "Bolt-action specialist",
      uses: 4,
      rules: 3,
      publishedAt: Date.parse("2026-11-27T12:00:00.000Z"),
    });
  });

  it("reads only well-formed metadata", () => {
    expect(readSummary(room(LISTED, "events:abcdefghjk"))).toBeNull();
    expect(readSummary(room(LISTED, "preset:NOPE"))).toBeNull();
    expect(readSummary(room({ ...LISTED, kind: "event" }))).toBeNull();
    expect(readSummary(room({ ...LISTED, name: "" }))).toBeNull();
    expect(readSummary(room({ ...LISTED, name: ["a", "b"] }))).toBeNull();
  });

  it("treats a malformed count or date as zero", () => {
    const summary = readSummary(
      room({ ...LISTED, uses: "-3", rules: "lots", publishedAt: "yesterday" }),
    );
    expect(summary).toMatchObject({ uses: 0, rules: 0, publishedAt: 0 });
  });
});

describe("presetStatus", () => {
  it("is listed or hidden, and null for anything that isn't a preset room", () => {
    expect(presetStatus(LISTED)).toBe("listed");
    expect(presetStatus({ ...LISTED, status: "hidden" })).toBe("hidden");
    expect(presetStatus({ ...LISTED, status: "deleted" })).toBeNull();
    expect(presetStatus({ ...LISTED, kind: "event" })).toBeNull();
  });
});

describe("preparePresetForPublishing", () => {
  const valid = {
    id: "local-1",
    name: "  DMR specialist ",
    description: "Marksman rifles only",
    rules: [{ id: "r1", kind: "ban", target: { type: "category", id: "body-armor" } }],
  };

  it("cleans the preset and gives it the public id", () => {
    const result = preparePresetForPublishing(valid, ID);
    expect(result).toEqual({ ok: true, preset: { ...valid, id: ID, name: "DMR specialist" } });
  });

  it("accepts a preset whose local id parsePreset wouldn't, since the public id replaces it", () => {
    const result = preparePresetForPublishing({ ...valid, id: "not a valid id!".repeat(5) }, ID);
    expect(result).toMatchObject({ ok: true, preset: { id: ID } });
  });

  it("rejects a preset with no name, and one with no rules", () => {
    expect(preparePresetForPublishing({ ...valid, name: " " }, ID)).toMatchObject({
      ok: false,
      rejection: { status: 400, error: "invalid-preset" },
    });
    expect(preparePresetForPublishing({ ...valid, rules: [] }, ID)).toMatchObject({
      ok: false,
      rejection: { status: 400, error: "no-rules" },
    });
  });

  it("rejects filtered text with 422, naming the field", () => {
    expect(preparePresetForPublishing({ ...valid, description: "sh1t rifles" }, ID)).toMatchObject({
      ok: false,
      rejection: { status: 422, error: "blocked-text", field: "description" },
    });
  });
});
