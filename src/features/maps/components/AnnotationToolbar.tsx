"use client";

import {
  ChevronDown,
  Circle,
  Eraser,
  MousePointer2,
  Pencil,
  RectangleHorizontal,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { cn } from "@/shared/ui/lib/cn";

import {
  DRAW_COLOR_PRESETS,
  ERASER_SIZE_MULTIPLIER,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from "../lib/annotations";

import type { BaseDrawTool } from "../hooks/use-draw-tool";
import type { CSSProperties } from "react";

interface Props {
  drawModeOn: boolean;
  onToggleDrawMode: () => void;
  baseTool: BaseDrawTool;
  onSelectTool: (tool: BaseDrawTool) => void;
  color: string;
  onSelectColor: (color: string) => void;
  width: number;
  onChangeWidth: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
  /** True right after a Clear click stashed strokes: the button morphs to "Restore" until a second click or any new draw/map-switch discards it (see `lib/annotations.ts`'s `clearLayer` doc comment). */
  clearPending: boolean;
  /** Off by default: a page reload normally clears every map's drawings rather than restoring them, so a quick sketch doesn't outlive the raid it was drawn for. Lives in the Advanced Settings section below Undo/Clear. */
  persistDrawingsAcrossReload: boolean;
  onTogglePersistDrawingsAcrossReload: (on: boolean) => void;
}

const TOOLS: readonly { id: BaseDrawTool; label: string; Icon: typeof Pencil }[] = [
  { id: "pen", label: "Pen", Icon: Pencil },
  { id: "circle", label: "Circle (hold Shift)", Icon: Circle },
  { id: "rect", label: "Rectangle", Icon: RectangleHorizontal },
  { id: "erase", label: "Eraser (hold Ctrl/Cmd)", Icon: Eraser },
  { id: "select", label: "Select & move", Icon: MousePointer2 },
];

/**
 * Floating drawing-tool controls ("Refined Rail": tool/color/size each in
 * their own labeled, center-aligned section rather than the left-packed rows
 * an earlier version had), rendered as a plain overlay inside
 * `AnnotationCanvas`'s `MapContainer` subtree (Leaflet is fine with
 * ordinary HTML children alongside its own layers). Purely controlled and
 * presentational: all state and pointer/keyboard logic lives in
 * `AnnotationCanvas` (via `useDrawTool` + `lib/annotations.ts`), so this
 * component only renders buttons and forwards clicks, plus one piece of its
 * own purely-local UI state (`advancedOpen`, whether the settings panel is
 * expanded). The bookend rows (the Draw toggle and the Undo/Clear row) span
 * the panel's full width; the Tool/Color/Size sections shrink-wrap and
 * center within it, since the width slider (not any of them) is what
 * actually sets the panel's width. The Advanced Settings link below Undo/
 * Clear is deliberately dim text, not a `Button`: opening a panel isn't an
 * action on par with Draw/Undo/Clear, so it shouldn't compete with them
 * visually. Empty by design today (no settings ship on by default); this is
 * where future ones land, starting with the one already here.
 */
export function AnnotationToolbar({
  drawModeOn,
  onToggleDrawMode,
  baseTool,
  onSelectTool,
  color,
  onSelectColor,
  width,
  onChangeWidth,
  onUndo,
  onClear,
  clearPending,
  persistDrawingsAcrossReload,
  onTogglePersistDrawingsAcrossReload,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isCustomColor = !DRAW_COLOR_PRESETS.includes(color);
  const widthPercent = ((width - STROKE_WIDTH_MIN) / (STROKE_WIDTH_MAX - STROKE_WIDTH_MIN)) * 100;

  // Because this overlay renders inside the map's own container div,
  // Leaflet's container-level mousedown/mousemove/mouseup listeners (which
  // `AnnotationCanvas`'s `useMapEvents` also reads) would otherwise receive
  // every bubbled click on these buttons too. Confirmed via a real browser
  // test: clicking a toolbar button while drawing was on corrupted the
  // in-progress stroke/lock-drag with a phantom event at the button's own
  // screen position. Stop propagation for exactly the 3 native event types
  // `useMapEvents` listens for. Deliberately NOT Leaflet's own
  // `L.DomEvent.disableClickPropagation` helper, which also stops native
  // `mousedown` and thereby (confirmed via a failing test) prevents the
  // native `click` this fires from ever reaching React's root-level
  // synthetic event listener, silently breaking every `onClick` in this
  // component. `click` itself is never touched here, so React's own
  // handling is unaffected; only Leaflet's raw listeners never see these.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    function stop(event: Event): void {
      event.stopPropagation();
    }

    el.addEventListener("mousedown", stop);
    el.addEventListener("mousemove", stop);
    el.addEventListener("mouseup", stop);
    return () => {
      el.removeEventListener("mousedown", stop);
      el.removeEventListener("mousemove", stop);
      el.removeEventListener("mouseup", stop);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="bg-card/95 border-border absolute top-16 right-3 z-[1000] flex flex-col items-center gap-2.5 rounded-md border p-2.5 shadow-md backdrop-blur-sm"
    >
      <Button
        type="button"
        size="sm"
        variant={drawModeOn ? "default" : "outline"}
        title="Toggle draw mode (Esc to exit)"
        onClick={onToggleDrawMode}
        className="w-full justify-center"
      >
        <Pencil className="size-4" />
        {drawModeOn ? "Drawing" : "Draw"}
      </Button>

      {drawModeOn && (
        <>
          <div className="flex w-full flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
              Tool
            </span>
            <div className="bg-muted flex gap-0.5 rounded-full p-1">
              {TOOLS.map(({ id, label, Icon }) => (
                <Button
                  key={id}
                  type="button"
                  size="icon"
                  variant={baseTool === id ? "default" : "ghost"}
                  title={label}
                  aria-label={label}
                  aria-pressed={baseTool === id}
                  onClick={() => {
                    onSelectTool(id);
                  }}
                  className="size-8 rounded-full"
                >
                  <Icon className="size-4" />
                </Button>
              ))}
            </div>
          </div>

          <hr className="border-border w-full" />

          <div className="flex w-full flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
              Color
            </span>
            <div className="flex items-center gap-2">
              {DRAW_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  title={preset}
                  aria-label={`Color ${preset}`}
                  aria-pressed={color === preset}
                  onClick={() => {
                    onSelectColor(preset);
                  }}
                  className={cn(
                    "size-6 shrink-0 rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]",
                    color === preset ? "border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset }}
                />
              ))}
              {/*
                The custom-color control is a conic-gradient "rainbow" ring,
                not a plain swatch showing whatever the current color happens
                to be: a bare native color well can look identical to one of
                the presets by coincidence, giving no visual hint that it
                opens a full picker rather than just being a 5th fixed
                option. The real `<input type="color">` sits directly on top,
                fully transparent but fully clickable/keyboard-focusable, so
                this is functionally a normal color input, just restyled.
              */}
              <span
                className={cn(
                  "relative size-6 shrink-0 rounded-full",
                  isCustomColor && "ring-foreground ring-2 ring-offset-1 ring-offset-transparent",
                )}
                title="Custom color"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ff3b3b, #ffb23b, #f4e04d, #6cd85a, #3bd8c9, #3b86ff, #a06fc4, #ff3b3b)",
                  }}
                />
                <input
                  type="color"
                  aria-label="Custom color"
                  value={color}
                  onChange={(event) => {
                    onSelectColor(event.target.value);
                  }}
                  className="absolute inset-0 size-full cursor-pointer rounded-full border-0 bg-transparent p-0 opacity-0"
                />
              </span>
            </div>
          </div>

          <hr className="border-border w-full" />

          <div className="flex w-full flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-[9px] font-semibold tracking-wide uppercase">
              Size
            </span>
            <div className="relative w-full pt-6">
              <span
                aria-hidden="true"
                className="bg-popover border-border text-foreground absolute -top-1 -translate-x-1/2 rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums shadow-sm"
                style={{ left: `${String(widthPercent)}%` }}
              >
                {width}px
              </span>
              {/*
                `appearance-none` on the input itself, not just its thumb
                pseudo-element: without it, Chrome/Edge on Windows still
                paints its own native groove behind the gradient-fill
                background below, a blocky rectangle that clashes with the
                rounded track/thumb this is going for.
              */}
              <input
                type="range"
                min={STROKE_WIDTH_MIN}
                max={STROKE_WIDTH_MAX}
                value={width}
                title={`Stroke width, ${String(width)}px (eraser scales ${String(ERASER_SIZE_MULTIPLIER)}x bigger; scroll while dragging a shape to change this live)`}
                onChange={(event) => {
                  onChangeWidth(Number(event.target.value));
                }}
                style={{ "--fill": `${String(widthPercent)}%` } as CSSProperties}
                className={cn(
                  "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-transparent outline-none",
                  "[background:linear-gradient(to_right,var(--color-primary)_var(--fill),var(--color-muted)_var(--fill))]",
                  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
                  "[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--color-card) [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(212,165,72,0.28)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
                  "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95",
                  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-muted",
                  "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-primary",
                  "[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--color-card) [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-[0_0_0_3px_rgba(212,165,72,0.28)] [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:duration-150",
                  "hover:[&::-moz-range-thumb]:scale-110 active:[&::-moz-range-thumb]:scale-95",
                )}
              />
            </div>
            <div className="text-muted-foreground flex w-full justify-between font-mono text-[9px] tabular-nums">
              <span>{STROKE_WIDTH_MIN}</span>
              <span>{Math.floor((STROKE_WIDTH_MIN + STROKE_WIDTH_MAX) / 2)}</span>
              <span>{STROKE_WIDTH_MAX}</span>
            </div>
          </div>

          <hr className="border-border w-full" />

          <div className="flex w-full gap-1">
            <Button type="button" size="sm" variant="outline" onClick={onUndo} className="flex-1">
              <Undo2 className="size-4" />
              Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={clearPending ? "secondary" : "destructive"}
              onClick={onClear}
              className="flex-1"
            >
              <Trash2 className="size-4" />
              {clearPending ? "Restore" : "Clear"}
            </Button>
          </div>

          {/*
            A dim text link rather than a real `Button`: this opens a
            settings panel, it isn't itself an action, so it shouldn't carry
            the same visual weight as Draw/Undo/Clear above it. Empty today
            on purpose (no default settings), just the one toggle below;
            more will land here over time rather than in new toolbar rows.
          */}
          <button
            type="button"
            onClick={() => {
              setAdvancedOpen((open) => !open);
            }}
            aria-expanded={advancedOpen}
            className="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 text-[11px]"
          >
            Advanced settings
            <ChevronDown
              className={cn("size-3 transition-transform", advancedOpen && "rotate-180")}
            />
          </button>

          {advancedOpen && (
            <div className="w-full">
              <label className="flex w-full cursor-pointer items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Save drawings after refresh</span>
                <Checkbox
                  checked={persistDrawingsAcrossReload}
                  onChange={(event) => {
                    onTogglePersistDrawingsAcrossReload(event.target.checked);
                  }}
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
