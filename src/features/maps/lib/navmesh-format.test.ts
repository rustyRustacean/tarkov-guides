import { describe, expect, it } from "vitest";

import { parseNavMesh } from "./navmesh-format";

function build(verts: number[], polys: number[][], nei: number[][]): ArrayBuffer {
  const indexCount = polys.reduce((n, p) => n + p.length, 0);
  const size = 20 + verts.length * 4 + polys.length + indexCount * 8;
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  "NMSH".split("").forEach((c, i) => {
    view.setUint8(i, c.charCodeAt(0));
  });
  view.setUint32(4, 1, true);
  view.setUint32(8, verts.length / 3, true);
  view.setUint32(12, polys.length, true);
  view.setUint32(16, indexCount, true);
  let at = 20;
  for (const v of verts) {
    view.setInt32(at, Math.round(v * 100), true);
    at += 4;
  }
  for (const p of polys) {
    view.setUint8(at, p.length);
    at += 1;
  }
  for (const p of polys) {
    for (const i of p) {
      view.setUint32(at, i, true);
      at += 4;
    }
  }
  for (const row of nei) {
    for (const n of row) {
      view.setInt32(at, n, true);
      at += 4;
    }
  }
  return buffer;
}

describe("parseNavMesh", () => {
  it("round-trips vertices, polygons and neighbours", () => {
    const verts = [0, 1.5, 0, 10, 1.5, 0, 10, 2.25, 10, 0, 1.5, 10, -3.07, 0, 4.01];
    const polys = [
      [0, 1, 2, 3],
      [1, 4, 2],
    ];
    const nei = [
      [-1, 1, -2, -1],
      [-1, -1, 0],
    ];
    const data = parseNavMesh(build(verts, polys, nei));
    expect(Array.from(data.verts)).toEqual(verts);
    expect(data.polys).toEqual(polys);
    expect(data.nei).toEqual(nei);
  });

  it("rejects something that is not a navmesh", () => {
    expect(() => parseNavMesh(new ArrayBuffer(32))).toThrow("not a navmesh file");
  });
});
