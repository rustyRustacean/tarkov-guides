import type { NavMeshData } from "./navmesh-route";

/**
 * Reads the compact walkable-mesh format written by
 * `scripts/navmesh/extract-navmesh.py --bin` (after gunzip):
 *
 *   "NMSH", u32 version, u32 vertCount, u32 polyCount, u32 indexCount,
 *   i32 verts[vertCount * 3] (centimetres), u8 counts[polyCount],
 *   u32 index[indexCount], i32 nei[indexCount]
 */
export function parseNavMesh(buffer: ArrayBuffer): NavMeshData {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3),
  );
  if (magic !== "NMSH") throw new Error("not a navmesh file");
  const version = view.getUint32(4, true);
  if (version !== 1) throw new Error(`unsupported navmesh version ${String(version)}`);
  const vertCount = view.getUint32(8, true);
  const polyCount = view.getUint32(12, true);
  const indexCount = view.getUint32(16, true);

  let at = 20;
  const verts = new Float64Array(vertCount * 3);
  for (let i = 0; i < verts.length; i += 1) {
    verts[i] = view.getInt32(at, true) / 100;
    at += 4;
  }
  const counts = new Uint8Array(buffer, at, polyCount);
  at += polyCount;
  // Alignment: the index and nei blocks are read through a DataView, which
  // has no alignment requirement.
  const polys: number[][] = new Array<number[]>(polyCount);
  const nei: number[][] = new Array<number[]>(polyCount);
  const neiBase = at + indexCount * 4;
  let cursor = 0;
  for (let p = 0; p < polyCount; p += 1) {
    const n = counts[p] ?? 0;
    const poly = new Array<number>(n);
    const edges = new Array<number>(n);
    for (let k = 0; k < n; k += 1) {
      poly[k] = view.getUint32(at + (cursor + k) * 4, true);
      edges[k] = view.getInt32(neiBase + (cursor + k) * 4, true);
    }
    polys[p] = poly;
    nei[p] = edges;
    cursor += n;
  }
  return { verts, polys, nei };
}
