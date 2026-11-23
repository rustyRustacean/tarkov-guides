import { describe, expect, it } from "vitest";

import { hashParams, MAX_PACKED_LENGTH, packForLink, unpackFromLink } from "./share-codec";

describe("share codec", () => {
  it("round-trips a value through a URL-safe string", async () => {
    const kit = {
      slots: { primary: { itemId: "5bfea6e90db834001b7347f3", attachments: [] } },
      carried: [{ itemId: "544fb3f34bdc2d03748b456a", qty: 1 }],
    };
    const packed = await packForLink(kit);
    expect(packed).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(await unpackFromLink(packed)).toEqual(kit);
  });

  it("compresses repetitive kits well below their JSON size", async () => {
    const carried = Array.from({ length: 30 }, (_, i) => ({
      itemId: `5c0e530286f7747fa14198${String(10 + i)}`,
      qty: 1,
    }));
    const packed = await packForLink({ slots: {}, carried });
    expect(packed.length).toBeLessThan(JSON.stringify({ carried }).length);
  });

  it("returns null for anything that isn't a packed value", async () => {
    expect(await unpackFromLink("")).toBeNull();
    expect(await unpackFromLink("2.abc")).toBeNull();
    expect(await unpackFromLink("1.!!!not-base64")).toBeNull();
    expect(await unpackFromLink("1.AAAA")).toBeNull();
    expect(await unpackFromLink(`1.${"A".repeat(MAX_PACKED_LENGTH)}`)).toBeNull();
  });

  it("reads fragment parameters", () => {
    const params = hashParams("#p=1.abc&k=1.def");
    expect(params.get("p")).toBe("1.abc");
    expect(params.get("k")).toBe("1.def");
  });
});
