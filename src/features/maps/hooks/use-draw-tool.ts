"use client";

import { useEffect, useState } from "react";

import { DEFAULT_STROKE_COLOR, STROKE_WIDTH_DEFAULT } from "../lib/annotations";

/** The 4 real toolbar tools - `line` is deliberately not modeled, see `Stroke`'s doc comment in `types.ts`. */
export type BaseDrawTool = "pen" | "circle" | "erase" | "lock";

interface UseDrawToolOptions {
  /** Wired to a hardcoded Ctrl+Z/Cmd+Z, matching legacy's own hardcoded binding (its rebindable `Q` hotkey is out of scope - see the Phase 5 plan's step 7). Only fires while Draw mode is on. */
  onUndo: () => void;
}

export interface UseDrawToolResult {
  drawModeOn: boolean;
  toggleDrawMode: () => void;
  /** The explicitly-selected tool (toolbar button state) - use {@link UseDrawToolResult.effectiveTool} for what should actually be drawn right now. */
  baseTool: BaseDrawTool;
  setBaseTool: (tool: BaseDrawTool) => void;
  /** `baseTool`, unless a momentary modifier key is currently held (Shift -> circle, Ctrl/Cmd -> erase). */
  effectiveTool: BaseDrawTool;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Owns the drawing toolbar's interaction state - shared by `AnnotationToolbar`
 * (renders/controls it) and `AnnotationCanvas` (reads `effectiveTool`/`color`/
 * `width` while drawing) via their common parent, `MapViewer`. Deliberately
 * has no knowledge of strokes/the Zustand store - `onUndo` is the only way
 * this hook reaches outside its own UI state, keeping it a plain,
 * store-independent interaction hook (mirrors this project's existing
 * separation between UI-only hooks and store-wiring hooks elsewhere).
 *
 * Ports legacy's confirmed `toggleDrawMode()`/momentary-modifier/Escape/
 * Ctrl+Z behavior (`fullscreen.js`) - explicitly drops its rebindable
 * WASD-color/Q-undo hotkey system and middle-mouse toggle (a config-surface
 * novelty, same category as this project's other dropped legacy novelties;
 * see the Phase 5 plan's step 7 for the full reasoning).
 */
export function useDrawTool({ onUndo }: UseDrawToolOptions): UseDrawToolResult {
  const [drawModeOn, setDrawModeOn] = useState(false);
  const [baseTool, setBaseTool] = useState<BaseDrawTool>("pen");
  const [modifierTool, setModifierTool] = useState<"circle" | "erase" | null>(null);
  const [color, setColor] = useState(DEFAULT_STROKE_COLOR);
  const [width, setWidth] = useState(STROKE_WIDTH_DEFAULT);

  useEffect(() => {
    if (!drawModeOn) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        setDrawModeOn(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        onUndo();
        return;
      }
      if (event.key === "Shift") setModifierTool("circle");
      else if (event.ctrlKey || event.metaKey) setModifierTool("erase");
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === "Shift" || event.key === "Control" || event.key === "Meta") {
        setModifierTool(null);
      }
    }

    function handleBlur(): void {
      setModifierTool(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [drawModeOn, onUndo]);

  return {
    drawModeOn,
    toggleDrawMode: () => {
      setDrawModeOn((on) => !on);
      setModifierTool(null);
    },
    baseTool,
    setBaseTool,
    effectiveTool: modifierTool ?? baseTool,
    color,
    setColor,
    width,
    setWidth,
  };
}
