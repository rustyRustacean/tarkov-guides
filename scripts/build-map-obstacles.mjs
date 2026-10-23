// Builds src/features/maps/data/obstacles/<map>.json from the map SVGs.
//
// The overview SVGs in public/maps/svg are layered vector maps (buildings,
// water, fences, the map border...). This extracts the GROUND level of the
// layers a walker cannot cross and converts them to game-space meters, using
// the same geometry the map screen draws the SVG with (map-config.ts), so an
// obstacle lands exactly where its building is drawn.
//
//   node scripts/build-map-obstacles.mjs            # all maps
//   node scripts/build-map-obstacles.mjs shoreline  # one map
//
// Output polygons are flat arrays [x0, z0, x1, z1, ...] rounded to 0.1 m.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SVG_DIR = join(root, "public", "maps", "svg");
const OUT_DIR = join(root, "src", "features", "maps", "data", "obstacles");

/** normalizedName -> svg file. Factory and Labs are indoor, multi-floor: no ground level, skipped. */
const MAPS = {
  customs: "Customs.svg",
  "ground-zero": "GroundZero.svg",
  interchange: "Interchange.svg",
  lighthouse: "Lighthouse.svg",
  reserve: "Reserve.svg",
  shoreline: "Shoreline.svg",
  "streets-of-tarkov": "StreetsOfTarkov.svg",
  terminal: "Terminal.svg",
  woods: "Woods.svg",
};

// ─── geometry config (parsed out of map-config.ts so there is one source) ───

function readGeometry() {
  const text = readFileSync(join(root, "src", "features", "maps", "lib", "map-config.ts"), "utf8");
  const out = {};
  const re = /^ {2}(?:"([a-z0-9-]+)"|([a-z0-9]+)): \{\n([\s\S]*?)\n {2}\},?\n/gm;
  let m;
  while ((m = re.exec(text))) {
    const key = m[1] ?? m[2];
    const body = m[3];
    const t = body.match(/transform: \[([^\]]+)\]/);
    const b = body.match(/bounds: \[\s*\[([^\]]+)\],\s*\[([^\]]+)\],?\s*\]/);
    if (!t || !b) continue;
    const r = body.match(/coordinateRotation: (-?[\d.]+)/);
    out[key] = {
      transform: t[1].split(",").map(Number),
      rotation: r ? Number(r[1]) : 0,
      bounds: [b[1].split(",").map(Number), b[2].split(",").map(Number)],
    };
  }
  return out;
}

/** SVG pixel -> game {x,z}: the exact inverse of how Leaflet draws the overlay. */
function makeProjector(cfg, width, height) {
  const [tx, mx, ty, my] = cfg.transform;
  const rad = (cfg.rotation * Math.PI) / 180;
  const rot = (lat, lng, r) => {
    const c = Math.cos(r);
    const s = Math.sin(r);
    return { lat: lng * s + lat * c, lng: lng * c - lat * s };
  };
  // bounds are [[x1, z1], [x2, z2]]; Leaflet bounds are [lat=z, lng=x].
  const [[x1, z1], [x2, z2]] = cfg.bounds;
  const corners = [
    { lat: z1, lng: x1 },
    { lat: z2, lng: x2 },
  ].map((c) => {
    const p = rot(c.lat, c.lng, rad); // projection
    return { x: tx * p.lng + mx, y: -ty * p.lat + my };
  });
  const minX = Math.min(corners[0].x, corners[1].x);
  const maxX = Math.max(corners[0].x, corners[1].x);
  const minY = Math.min(corners[0].y, corners[1].y);
  const maxY = Math.max(corners[0].y, corners[1].y);
  return (u, v) => {
    const sx = minX + (u / width) * (maxX - minX);
    const sy = minY + (v / height) * (maxY - minY);
    const px = (sx - mx) / tx;
    const py = (sy - my) / -ty;
    const ll = rot(py, px, -rad); // unproject
    return { x: ll.lng, z: ll.lat };
  };
}

// ─── SVG reading ───────────────────────────────────────────────────────────

function parseTransform(attr) {
  if (!attr) return [1, 0, 0, 1, 0, 0];
  let result = [1, 0, 0, 1, 0, 0];
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  for (const m of attr.matchAll(/(translate|matrix|scale)\(([^)]*)\)/g)) {
    const n = m[2]
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    let t = [1, 0, 0, 1, 0, 0];
    if (m[1] === "translate") t = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0];
    else if (m[1] === "scale") t = [n[0] ?? 1, 0, 0, n[1] ?? n[0] ?? 1, 0, 0];
    else if (n.length === 6) t = n;
    result = mul(result, t);
  }
  return result;
}

const applyTf = (t, x, y) => [t[0] * x + t[2] * y + t[4], t[1] * x + t[3] * y + t[5]];

/** Path data -> list of { points: [[x,y]...], closed }. Curves are flattened. */
function parsePath(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const subpaths = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastCtl = null;
  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);
  const begin = (px, py) => {
    cur = { points: [[px, py]], closed: false };
    subpaths.push(cur);
    sx = px;
    sy = py;
  };
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 8; k += 1) {
      const t = k / 8;
      const a = (1 - t) ** 3;
      const b = 3 * (1 - t) ** 2 * t;
      const c = 3 * (1 - t) * t * t;
      const e = t ** 3;
      cur.points.push([a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === "Z") {
      if (cur) cur.closed = true;
      x = sx;
      y = sy;
      lastCtl = null;
      continue;
    }
    if (C === "M") {
      const nx = num() + (rel ? x : 0);
      const ny = num() + (rel ? y : 0);
      x = nx;
      y = ny;
      begin(x, y);
      cmd = rel ? "l" : "L";
      lastCtl = null;
    } else if (C === "L") {
      x = num() + (rel ? x : 0);
      y = num() + (rel ? y : 0);
      cur.points.push([x, y]);
      lastCtl = null;
    } else if (C === "H") {
      x = num() + (rel ? x : 0);
      cur.points.push([x, y]);
      lastCtl = null;
    } else if (C === "V") {
      y = num() + (rel ? y : 0);
      cur.points.push([x, y]);
      lastCtl = null;
    } else if (C === "C") {
      const x1 = num() + (rel ? x : 0);
      const y1 = num() + (rel ? y : 0);
      const x2 = num() + (rel ? x : 0);
      const y2 = num() + (rel ? y : 0);
      const x3 = num() + (rel ? x : 0);
      const y3 = num() + (rel ? y : 0);
      cubic(x, y, x1, y1, x2, y2, x3, y3);
      x = x3;
      y = y3;
      lastCtl = [x2, y2];
    } else if (C === "S") {
      const x2 = num() + (rel ? x : 0);
      const y2 = num() + (rel ? y : 0);
      const x3 = num() + (rel ? x : 0);
      const y3 = num() + (rel ? y : 0);
      const x1 = lastCtl ? 2 * x - lastCtl[0] : x;
      const y1 = lastCtl ? 2 * y - lastCtl[1] : y;
      cubic(x, y, x1, y1, x2, y2, x3, y3);
      x = x3;
      y = y3;
      lastCtl = [x2, y2];
    } else {
      // Unsupported command (Q/T/A are not used by these files): skip its numbers.
      while (i < tokens.length && !/[a-zA-Z]/.test(tokens[i])) i += 1;
    }
  }
  return subpaths;
}

/**
 * Walks the SVG once, tracking the group stack, and returns every path with
 * its accumulated transform and the classes/ids of its ancestors.
 */
function readPaths(svg) {
  const body = svg.replace(/<defs>[\s\S]*?<\/defs>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  const stack = [{ tf: [1, 0, 0, 1, 0, 0], id: "", cls: "" }];
  const paths = [];
  const tagRe = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m;
  while ((m = tagRe.exec(body))) {
    const [, closing, name, attrs, selfClose] = m;
    if (name === "g") {
      if (closing) {
        if (stack.length > 1) stack.pop();
      } else if (!selfClose) {
        const parent = stack[stack.length - 1];
        const own = parseTransform((attrs.match(/transform="([^"]*)"/) ?? [])[1]);
        const mul = (a, b) => [
          a[0] * b[0] + a[2] * b[1],
          a[1] * b[0] + a[3] * b[1],
          a[0] * b[2] + a[2] * b[3],
          a[1] * b[2] + a[3] * b[3],
          a[0] * b[4] + a[2] * b[5] + a[4],
          a[1] * b[4] + a[3] * b[5] + a[5],
        ];
        stack.push({
          tf: mul(parent.tf, own),
          id: `${parent.id}/${(attrs.match(/\bid="([^"]*)"/) ?? [])[1] ?? ""}`,
          cls: `${parent.cls} ${(attrs.match(/\bclass="([^"]*)"/) ?? [])[1] ?? ""}`,
        });
      }
    } else if (name === "path" && !closing) {
      const d = (attrs.match(/\bd="([^"]*)"/) ?? [])[1];
      if (!d) continue;
      const parent = stack[stack.length - 1];
      const own = parseTransform((attrs.match(/transform="([^"]*)"/) ?? [])[1]);
      const own2 = (attrs.match(/class="([^"]*)"/) ?? [])[1] ?? "";
      const mulT = (a, b) => [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
      ];
      paths.push({
        d,
        tf: mulT(parent.tf, own),
        id: parent.id,
        cls: `${parent.cls} ${own2}`,
      });
    }
  }
  return paths;
}

// ─── layer selection ───────────────────────────────────────────────────────

const has = (p, word) => new RegExp(`(^|[\\s/])${word}`, "i").test(p.cls);

function layerOf(p) {
  // Only the ground level: upper floors and basements sit inside a footprint
  // that is already there, and they would otherwise double-count.
  const ground = p.id.includes("/Ground_Level");
  if (!ground) return null;
  if (/\/(Underground|First_Floor|Second_Floor|Third_Floor|Fourth_Floor|Fifth_Floor)/i.test(p.id))
    return null;
  if (/Powerline/i.test(p.id) || has(p, "powerline")) return null;
  if (has(p, "map_border")) return "limit";
  if (has(p, "fence")) return "fences";
  if (has(p, "water")) return "water";
  if (has(p, "building") || (has(p, "floor") === false && /Bunker_entr/i.test(p.id)))
    return "buildings";
  return null;
}

// ─── main ──────────────────────────────────────────────────────────────────

const geometry = readGeometry();
const only = process.argv[2];
mkdirSync(OUT_DIR, { recursive: true });

for (const [name, file] of Object.entries(MAPS)) {
  if (only && only !== name) continue;
  const cfg = geometry[name];
  if (!cfg) {
    console.log(`${name}: no geometry in map-config.ts, skipped`);
    continue;
  }
  const svg = readFileSync(join(SVG_DIR, file), "utf8");
  const vb = svg
    .match(/viewBox="([^"]+)"/)[1]
    .split(/\s+/)
    .map(Number);
  const [, , width, height] = vb;
  const project = makeProjector(cfg, width, height);

  const out = { map: name, buildings: [], water: [], fences: [], limit: [] };
  for (const p of readPaths(svg)) {
    const layer = layerOf(p);
    if (!layer) continue;
    for (const sub of parsePath(p.d)) {
      if (sub.points.length < 2) continue;
      const flat = [];
      for (const [px, py] of sub.points) {
        const [ux, uy] = applyTf(p.tf, px, py);
        const g = project(ux, uy);
        flat.push(Math.round(g.x * 10) / 10, Math.round(g.z * 10) / 10);
      }
      // Fences and the border are open polylines; buildings and water are areas.
      const isLine = layer === "fences" || layer === "limit";
      if (!isLine && sub.points.length < 3) continue;
      out[layer].push(flat);
    }
  }
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(out));
  const counts = Object.entries(out)
    .filter(([k]) => k !== "map")
    .map(([k, v]) => `${k} ${v.length}`)
    .join(", ");
  console.log(`${name}: ${counts}`);
}
