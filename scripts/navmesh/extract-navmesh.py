"""Reads a Unity NavMeshData .asset (YAML, tiles as hex Detour data) and writes
the walkable polygons as compact JSON in game space.

    python scripts/navmesh/extract-navmesh.py <NavMesh-*.asset> <out.json> [--stats]
    python scripts/navmesh/extract-navmesh.py <NavMesh-*.asset> <out.bin.gz> --bin

With --bin the output is the compact format the site loads (gzip of):
    char[4] "NMSH", u32 version(1), u32 vertCount, u32 polyCount, u32 indexCount,
    i32 verts[vertCount*3]   (centimetres, x y z),
    u8  counts[polyCount]    (vertices per polygon),
    u32 index[indexCount]    (vertex indices, polygons back to back),
    i32 nei[indexCount]      (per edge: polygon index, -1 wall, -2 tile border)

Tile layout (Unity's Detour variant), little endian:
    11 x int32: magic 'DNAV', version, x, y, userId, polyCount, vertCount,
                maxLinkCount, detailMeshCount, detailVertCount, detailTriCount
    float bmin[3], bmax[3], then one float (quantisation factor)
    float verts[vertCount * 3]
    poly[polyCount] (32 bytes): u16 verts[6], u16 neis[6], u32 flags, u32 vertCount
        neis: 0 = no neighbour, 1..N = polygon index + 1 inside this tile,
        0x8000 | side = the edge lies on the tile border (matched by geometry later).
Links and the detail mesh are ignored.

Output: {"tile": 25.6, "verts": [x, y, z, ...], "polys": [[v0, v1, ...], ...],
         "nei": [[n0, n1, ...], ...]} with coordinates rounded to 1 cm. `nei`
runs parallel to `polys` (edge i joins vertex i to i+1): a global polygon
index for an internal neighbour, -1 for a wall, -2 for a tile-border edge.
"""

import json
import re
import struct
import sys

MAGIC = 0x444E4156  # 'DNAV'
POLY_BYTES = 32
VERTS_PER_POLY = 6


def read_tiles(path):
    """Yield the raw bytes of each non-empty tile."""
    text = open(path, "r", encoding="utf-8", errors="replace").read()
    for match in re.finditer(r"m_MeshData: ([0-9a-f]*)", text):
        hexed = match.group(1)
        if len(hexed) < 200:
            continue
        yield bytes.fromhex(hexed)


def parse_tile(data):
    if len(data) < 72:
        return None
    ints = struct.unpack_from("<11i", data, 0)
    magic, version, tx, ty, user_id, poly_count, vert_count = ints[:7]
    if magic != MAGIC or poly_count <= 0 or vert_count <= 0:
        return None
    base = 44 + 6 * 4 + 4  # ints, bmin/bmax, quantisation float
    need = base + vert_count * 12 + poly_count * POLY_BYTES
    if len(data) < need:
        raise ValueError(f"tile {tx},{ty}: {len(data)} bytes, need at least {need}")
    verts = struct.unpack_from(f"<{vert_count * 3}f", data, base)
    polys = []
    neis = []
    off = base + vert_count * 12
    for _ in range(poly_count):
        vs = struct.unpack_from("<6H", data, off)
        ns = struct.unpack_from("<6H", data, off + 12)
        _flags, count = struct.unpack_from("<II", data, off + 24)
        if not 3 <= count <= VERTS_PER_POLY:
            raise ValueError(f"tile {tx},{ty}: polygon with {count} vertices")
        polys.append(list(vs[:count]))
        neis.append(list(ns[:count]))
        off += POLY_BYTES
    return (tx, ty), verts, polys, neis


def main():
    src, dst = sys.argv[1], sys.argv[2]
    stats = "--stats" in sys.argv
    all_verts = []
    all_polys = []
    all_neis = []
    tiles = 0
    bad = 0
    bounds = [1e9, -1e9, 1e9, -1e9, 1e9, -1e9]
    for raw in read_tiles(src):
        try:
            parsed = parse_tile(raw)
        except ValueError as err:
            bad += 1
            print("skip:", err, file=sys.stderr)
            continue
        if parsed is None:
            continue
        _, verts, polys, neis = parsed
        tiles += 1
        poly_base = len(all_polys)
        base = len(all_verts) // 3
        for i in range(0, len(verts), 3):
            x, y, z = verts[i], verts[i + 1], verts[i + 2]
            bounds[0] = min(bounds[0], x)
            bounds[1] = max(bounds[1], x)
            bounds[2] = min(bounds[2], y)
            bounds[3] = max(bounds[3], y)
            bounds[4] = min(bounds[4], z)
            bounds[5] = max(bounds[5], z)
            all_verts.extend((round(x, 2), round(y, 2), round(z, 2)))
        for poly, nei in zip(polys, neis):
            all_polys.append([base + v for v in poly])
            all_neis.append(
                [
                    -2 if n & 0x8000 else (-1 if n == 0 else poly_base + n - 1)
                    for n in nei
                ]
            )

    if "--bin" in sys.argv:
        import gzip

        flat_idx = [i for poly in all_polys for i in poly]
        flat_nei = [n for row in all_neis for n in row]
        blob = bytearray()
        blob += b"NMSH"
        blob += struct.pack("<4I", 1, len(all_verts) // 3, len(all_polys), len(flat_idx))
        blob += struct.pack(f"<{len(all_verts)}i", *[int(round(v * 100)) for v in all_verts])
        blob += bytes(len(poly) for poly in all_polys)
        blob += struct.pack(f"<{len(flat_idx)}I", *flat_idx)
        blob += struct.pack(f"<{len(flat_nei)}i", *flat_nei)
        with gzip.GzipFile(dst, "wb", compresslevel=9, mtime=0) as fh:
            fh.write(bytes(blob))
    else:
        out = {"tile": 25.6, "verts": all_verts, "polys": all_polys, "nei": all_neis}
        with open(dst, "w", encoding="utf-8") as fh:
            json.dump(out, fh, separators=(",", ":"))
    print(
        f"tiles {tiles} (skipped {bad}), verts {len(all_verts) // 3}, polys {len(all_polys)}, "
        f"x [{bounds[0]:.0f},{bounds[1]:.0f}] y [{bounds[2]:.0f},{bounds[3]:.0f}] z [{bounds[4]:.0f},{bounds[5]:.0f}]"
    )
    if stats:
        from collections import Counter

        print("poly vertex counts:", dict(Counter(len(p) for p in all_polys)))
        edges = [n for row in all_neis for n in row]
        print(
            "edges: internal",
            sum(1 for n in edges if n >= 0),
            "wall",
            sum(1 for n in edges if n == -1),
            "tile border",
            sum(1 for n in edges if n == -2),
        )


if __name__ == "__main__":
    main()
