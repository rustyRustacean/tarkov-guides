"use client";

import { Circle, Eraser, Lock, Pencil, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/shared/ui/button/Button";
import { cn } from "@/shared/ui/lib/cn";

import {
  DRAW_COLOR_PRESETS,
  ERASER_SIZE_MULTIPLIER,
  STROKE_WIDTH_MAX,
  STROKE_WIDTH_MIN,
} from "../lib/annotations";

import type { BaseDrawTool } from "../hooks/use-draw-tool";

interface Props {
  drawModeOn: boolean;
  onToggleDrawMode: () => void;
  /** Disabled (not hidden) when there's no active profile - annotations are per-profile, so drawing has nowhere to be saved yet. */
  drawModeDisabled: boolean;
  baseTool: BaseDrawTool;
  onSelectTool: (tool: BaseDrawTool) => void;
  color: string;
  onSelectColor: (color: string) => void;
  width: number;
  onChangeWidth: (width: number) => void;
  onUndo: () => void;
  onClear: () => void;
  /** True right after a Clear click stashed strokes - the button morphs to "Restore" until a second click or any new draw/map-switch discards it (see `lib/annotations.ts`'s `clearLayer` doc comment). */
  clearPending: boolean;
}

const TOOLS: readonly { id: BaseDrawTool; label: string; Icon: typeof Pencil }[] = [
  { id: "pen", label: "Pen", Icon: Pencil },
  { id: "circle", label: "Circle (hold Shift)", Icon: Circle },
  { id: "erase", label: "Eraser (hold Ctrl/Cmd)", Icon: Eraser },
  { id: "lock", label: "Lock area", Icon: Lock },
];

/**
 * Floating drawing-tool controls, rendered as a plain overlay inside
 * `AnnotationCanvas`'s `MapContainer` subtree (Leaflet is fine with
 * ordinary HTML children alongside its own layers). Purely controlled/
 * presentational - all state and pointer/keyboard logic lives in
 * `AnnotationCanvas` (via `useDrawTool` + `lib/annotations.ts`), so this
 * component only renders buttons and forwards clicks.
 */
export function AnnotationToolbar({
  drawModeOn,
  onToggleDrawMode,
  drawModeDisabled,
  baseTool,
  onSelectTool,
  color,
  onSelectColor,
  width,
  onChangeWidth,
  onUndo,
  onClear,
  clearPending,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Because this overlay renders inside the map's own container div,
  // Leaflet's container-level mousedown/mousemove/mouseup listeners (which
  // `AnnotationCanvas`'s `useMapEvents` also reads) would otherwise receive
  // every bubbled click on these buttons too - confirmed via a real browser
  // test: clicking a toolbar button while drawing was on corrupted the
  // in-progress stroke/lock-drag with a phantom event at the button's own
  // screen position. Stop propagation for exactly the 3 native event types
  // `useMapEvents` listens for - deliberately NOT Leaflet's own
  // `L.DomEvent.disableClickPropagation` helper, which also stops native
  // `mousedown`, and thereby (confirmed via a failing test) prevents the
  // native `click` this fires from ever reaching React's root-level
  // synthetic event listener, silently breaking every `onClick` in this
  // component. `click` itself is never touched here, so React's own
  // handling is unaffected - only Leaflet's raw listeners never see these.
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
      className="bg-card/95 border-border absolute top-2 left-2 z-[1000] flex flex-col gap-2 rounded-md border p-2 shadow-md"
    >
      <Button
        type="button"
        size="sm"
        variant={drawModeOn ? "default" : "outline"}
        disabled={drawModeDisabled}
        title={
          drawModeDisabled ? "Create a profile to annotate maps" : "Toggle draw mode (Esc to exit)"
        }
        onClick={onToggleDrawMode}
      >
        <Pencil className="size-4" />
        {drawModeOn ? "Drawing" : "Draw"}
      </Button>

      {drawModeOn && (
        <>
          <div className="flex gap-1">
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
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
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
                  "size-6 shrink-0 rounded-full border-2",
                  color === preset ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: preset }}
              />
            ))}
            <input
              type="color"
              aria-label="Custom color"
              value={color}
              onChange={(event) => {
                onSelectColor(event.target.value);
              }}
              className={cn(
                "size-6 shrink-0 cursor-pointer rounded-full border-2 bg-transparent p-0",
                "[&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0",
                "[&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none",
                "[&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none",
                DRAW_COLOR_PRESETS.includes(color) ? "border-transparent" : "border-foreground",
              )}
            />
          </div>

          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Width
            <input
              type="range"
              min={STROKE_WIDTH_MIN}
              max={STROKE_WIDTH_MAX}
              value={width}
              title={`Stroke width (eraser scales ${String(ERASER_SIZE_MULTIPLIER)}x bigger)`}
              onChange={(event) => {
                onChangeWidth(Number(event.target.value));
              }}
              className={cn(
                "bg-border h-1.5 flex-1 cursor-pointer rounded-full",
                "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
                "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:[-webkit-appearance:none]",
                "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full",
                "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-none",
              )}
            />
            <span className="w-6 text-right">{width}</span>
          </label>

          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={onUndo}>
              <Undo2 className="size-4" />
              Undo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={clearPending ? "secondary" : "destructive"}
              onClick={onClear}
            >
              <Trash2 className="size-4" />
              {clearPending ? "Restore" : "Clear"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
