"use client";

// TEMPORARY calibration tool - not part of the app. Derives a per-variant
// affine transform mapping game world (x,z) -> image fractional (fx,fy) for
// 2D/3D map images so quest markers can be aligned. Delete this whole folder
// when calibration is finished.

import { useMemo, useRef, useState } from "react";

import {
  getMapConfig,
  MAP_NORMALIZED_NAMES,
  type MapVariant,
} from "@/features/maps/lib/map-config";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import type { PointerEvent as ReactPointerEvent } from "react";

interface ZonePoint {
  key: string;
  taskName: string;
  objectiveDescription: string;
  x: number;
  z: number;
}
interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function det3(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number,
): number {
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** Least-squares affine fx = a·x + b·z + c, fy = d·x + e·z + f. Null for < 3 or degenerate points. */
function solveAffine(
  points: readonly { x: number; z: number; fx: number; fy: number }[],
): Affine | null {
  if (points.length < 3) return null;
  let Sxx = 0,
    Sxz = 0,
    Sx = 0,
    Szz = 0,
    Sz = 0,
    S1 = 0;
  let Sxfx = 0,
    Szfx = 0,
    Sfx = 0,
    Sxfy = 0,
    Szfy = 0,
    Sfy = 0;
  for (const p of points) {
    Sxx += p.x * p.x;
    Sxz += p.x * p.z;
    Sx += p.x;
    Szz += p.z * p.z;
    Sz += p.z;
    S1 += 1;
    Sxfx += p.x * p.fx;
    Szfx += p.z * p.fx;
    Sfx += p.fx;
    Sxfy += p.x * p.fy;
    Szfy += p.z * p.fy;
    Sfy += p.fy;
  }
  const D = det3(Sxx, Sxz, Sx, Sxz, Szz, Sz, Sx, Sz, S1);
  if (Math.abs(D) < 1e-12) return null;
  const solve = (r1: number, r2: number, r3: number): [number, number, number] => [
    det3(r1, Sxz, Sx, r2, Szz, Sz, r3, Sz, S1) / D,
    det3(Sxx, r1, Sx, Sxz, r2, Sz, Sx, r3, S1) / D,
    det3(Sxx, Sxz, r1, Sxz, Szz, r2, Sx, Sz, r3) / D,
  ];
  const [a, b, c] = solve(Sxfx, Szfx, Sfx);
  const [d, e, f] = solve(Sxfy, Szfy, Sfy);
  return { a, b, c, d, e, f };
}

function applyAffine(t: Affine, x: number, z: number): { fx: number; fy: number } {
  return { fx: t.a * x + t.b * z + t.c, fy: t.d * x + t.e * z + t.f };
}

function imageVariants(normalizedName: string): readonly MapVariant[] {
  return (getMapConfig(normalizedName)?.variants ?? []).filter((v) => v.interactive !== true);
}

/** Temporary in-app calibration surface. Not linked from anywhere; reached at `/calibrate`. */
export default function CalibratePage() {
  const { data } = useTarkovGameData();
  const tasks = useMemo(() => data?.tasks ?? [], [data]);

  const [mapName, setMapName] = useState("reserve");
  const [variantId, setVariantId] = useState("2d");
  const [placed, setPlaced] = useState<Record<string, { fx: number; fy: number }>>({});
  const [activeKey, setActiveKey] = useState<string>("");
  const [search, setSearch] = useState("");
  const [imageWidth, setImageWidth] = useState(1400);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [draggingDot, setDraggingDot] = useState<string | null>(null);
  const [panel, setPanel] = useState({ x: 16, y: 16 });
  const panelDrag = useRef<{ dx: number; dy: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const variants = imageVariants(mapName);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  const zonePoints = useMemo<ZonePoint[]>(() => {
    const out: ZonePoint[] = [];
    for (const task of tasks) {
      for (const objective of task.objectives) {
        (objective.zones ?? []).forEach((zone, zi) => {
          if (zone.map?.normalizedName !== mapName || !zone.position) return;
          out.push({
            key: `${task.id}:${objective.id}:${String(zi)}`,
            taskName: task.name,
            objectiveDescription: objective.description,
            x: zone.position.x,
            z: zone.position.z,
          });
        });
      }
    }
    return out;
  }, [tasks, mapName]);

  const activeZone = zonePoints.find((z) => z.key === activeKey);

  const controlPoints = zonePoints.flatMap((zp) => {
    const p = placed[zp.key];
    return p ? [{ ...zp, fx: p.fx, fy: p.fy }] : [];
  });
  const affine = solveAffine(controlPoints);

  const residuals =
    affine && natural
      ? controlPoints.map((cp) => {
          const p = applyAffine(affine, cp.x, cp.z);
          return {
            key: cp.key,
            errPx: Math.hypot((p.fx - cp.fx) * natural.w, (p.fy - cp.fy) * natural.h),
          };
        })
      : [];
  const rms = residuals.length
    ? Math.sqrt(residuals.reduce((s, r) => s + r.errPx * r.errPx, 0) / residuals.length)
    : null;

  function fractionFrom(
    clientX: number,
    clientY: number,
    el: HTMLElement,
  ): { fx: number; fy: number } {
    const rect = el.getBoundingClientRect();
    return { fx: (clientX - rect.left) / rect.width, fy: (clientY - rect.top) / rect.height };
  }

  function placeActive(clientX: number, clientY: number, el: HTMLElement): void {
    if (!activeZone) return;
    const point = fractionFrom(clientX, clientY, el);
    setPlaced((prev) => ({ ...prev, [activeZone.key]: point }));
  }

  const query = search.trim().toLowerCase();
  const matches = query
    ? zonePoints
        .filter(
          (z) =>
            z.taskName.toLowerCase().includes(query) ||
            z.objectiveDescription.toLowerCase().includes(query),
        )
        .slice(0, 12)
    : [];

  function onImageClick(event: ReactPointerEvent<HTMLDivElement>): void {
    if (draggingDot) return;
    placeActive(event.clientX, event.clientY, event.currentTarget);
  }
  function onImagePointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!draggingDot) return;
    const point = fractionFrom(event.clientX, event.clientY, event.currentTarget);
    setPlaced((prev) => ({ ...prev, [draggingDot]: point }));
  }
  function endDotDrag(): void {
    setDraggingDot(null);
  }

  function removePoint(key: string): void {
    setPlaced((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
  }

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    panelDrag.current = { dx: event.clientX - panel.x, dy: event.clientY - panel.y };
  }
  function onHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!panelDrag.current) return;
    setPanel({ x: event.clientX - panelDrag.current.dx, y: event.clientY - panelDrag.current.dy });
  }
  function onHeaderPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
    panelDrag.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }

  const round = (n: number): number => Math.round(n * 1e6) / 1e6;
  const output = affine
    ? JSON.stringify(
        {
          map: mapName,
          variant: variant?.id,
          calibration: {
            a: round(affine.a),
            b: round(affine.b),
            c: round(affine.c),
            d: round(affine.d),
            e: round(affine.e),
            f: round(affine.f),
          },
        },
        null,
        2,
      )
    : "// place at least 3 points";

  function resetForMap(next: string): void {
    setMapName(next);
    setPlaced({});
    setActiveKey("");
    setNatural(null);
    const first = imageVariants(next)[0];
    if (first) setVariantId(first.id);
  }

  return (
    <div className="min-h-screen">
      {/* Full map, scrollable. */}
      {variant && (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- temporary tool: pixel-picking surface, keyboard not applicable.
        <div
          className="relative cursor-crosshair touch-none select-none"
          style={{ width: imageWidth }}
          onClick={onImageClick}
          onPointerMove={onImagePointerMove}
          onPointerUp={endDotDrag}
          onPointerLeave={endDotDrag}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- temporary tool, not shipped UI. */}
          <img
            src={variant.imageUrl}
            alt=""
            draggable={false}
            className="pointer-events-none block w-full select-none"
            onLoad={(e) => {
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
            }}
          />
          {showAll &&
            affine &&
            zonePoints.map((zp) => {
              const p = applyAffine(affine, zp.x, zp.z);
              if (p.fx < 0 || p.fx > 1 || p.fy < 0 || p.fy > 1) return null;
              return (
                <div
                  key={`pred-${zp.key}`}
                  className="bg-status-blue pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${String(p.fx * 100)}%`, top: `${String(p.fy * 100)}%` }}
                  title={zp.taskName}
                />
              );
            })}
          {controlPoints.map((cp) => (
            <div
              key={`cp-${cp.key}`}
              className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white ${
                activeZone?.key === cp.key ? "bg-status-amber" : "bg-status-teal"
              }`}
              style={{ left: `${String(cp.fx * 100)}%`, top: `${String(cp.fy * 100)}%` }}
              title={`${cp.taskName} - drag to adjust`}
              onPointerDown={(event) => {
                event.stopPropagation();
                setActiveKey(cp.key);
                setDraggingDot(cp.key);
              }}
            />
          ))}
        </div>
      )}

      {/* Floating control panel. */}
      <div
        className="border-border bg-card fixed z-50 flex w-80 flex-col gap-2 rounded-lg border p-3 text-sm shadow-xl"
        style={{ left: panel.x, top: panel.y, maxHeight: "94vh" }}
      >
        <div
          className="bg-muted -m-3 mb-1 flex cursor-move items-center justify-between rounded-t-lg px-3 py-2 text-xs font-semibold"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
        >
          <span>Map calibration (temporary) — drag to move</span>
        </div>

        <div className="flex gap-2">
          <select
            value={mapName}
            onChange={(e) => {
              resetForMap(e.target.value);
            }}
            className="border-border bg-background flex-1 rounded border p-1"
          >
            {MAP_NORMALIZED_NAMES.map((m) => (
              <option key={m} value={m}>
                {getMapConfig(m)?.name ?? m}
              </option>
            ))}
          </select>
          <select
            value={variant?.id ?? ""}
            onChange={(e) => {
              setVariantId(e.target.value);
              setPlaced({});
              setActiveKey("");
              setNatural(null);
            }}
            className="border-border bg-background flex-1 rounded border p-1"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          <span>Type a task name, then click its objective below:</span>
          <input
            type="text"
            value={search}
            placeholder="e.g. The Bunker"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="border-border bg-background text-foreground rounded border p-1"
          />
        </label>
        {matches.length > 0 && (
          <div className="border-border flex max-h-40 flex-col overflow-y-auto rounded border">
            {matches.map((z) => (
              <button
                key={z.key}
                type="button"
                onClick={() => {
                  setActiveKey(z.key);
                }}
                className={`border-border border-b p-1 text-left text-xs last:border-b-0 ${
                  activeZone?.key === z.key ? "bg-primary/15" : ""
                }`}
              >
                {placed[z.key] ? "✓ " : "○ "}
                <span className="font-medium">{z.taskName}</span>{" "}
                <span className="text-muted-foreground">
                  {z.objectiveDescription.slice(0, 34)} · x{z.x.toFixed(0)} z{z.z.toFixed(0)}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-primary/10 text-primary rounded p-2 text-xs">
          {activeZone ? (
            <>
              Click the map to place: <b>{activeZone.taskName}</b>. Drag a dot to fine-tune.
            </>
          ) : zonePoints.length > 0 ? (
            <>Type a task name above and pick its objective to start.</>
          ) : (
            <>No task objectives on this map.</>
          )}
        </div>

        <label className="text-muted-foreground flex flex-col gap-1 text-xs">
          <span>Image width: {imageWidth}px</span>
          <input
            type="range"
            min={600}
            max={4000}
            step={50}
            value={imageWidth}
            onChange={(e) => {
              setImageWidth(Number(e.target.value));
            }}
          />
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => {
              setShowAll(e.target.checked);
            }}
          />
          Preview all objectives (blue) with current fit
        </label>

        <div className="text-xs">
          Placed <b>{controlPoints.length}</b> / need ≥ 3
          {rms !== null && (
            <>
              {" "}
              · RMS{" "}
              <b className={rms < 8 ? "text-status-teal" : "text-status-amber"}>
                {rms.toFixed(1)}px
              </b>
            </>
          )}
        </div>

        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
          {controlPoints.map((cp) => {
            const res = residuals.find((r) => r.key === cp.key);
            return (
              <div
                key={`row-${cp.key}`}
                className="border-border flex items-center justify-between gap-2 rounded border p-1"
              >
                <span className="truncate">
                  {cp.taskName}
                  {res && (
                    <span className="text-muted-foreground"> · {res.errPx.toFixed(1)}px</span>
                  )}
                </span>
                <button
                  type="button"
                  className="text-status-red shrink-0 px-1"
                  onClick={() => {
                    removePoint(cp.key);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border-border rounded border px-2 py-1 text-xs"
            onClick={() => {
              void navigator.clipboard.writeText(output).then(() => {
                setCopied(true);
                setTimeout(() => {
                  setCopied(false);
                }, 1200);
              });
            }}
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
          <span className="text-muted-foreground text-xs">
            for {mapName} / {variant?.id}
          </span>
        </div>
        <pre className="border-border bg-background max-h-32 overflow-auto rounded border p-2 text-[10px]">
          {output}
        </pre>
      </div>
    </div>
  );
}
