"use client";

import { Ruler } from "lucide-react";

import { Button } from "@/shared/ui/button/Button";

import { useEnsureMarkerView } from "../hooks/use-ensure-marker-view";
import { walkingRouteAvailable } from "../lib/exit-path-maps";
import { useRulerStore } from "../ruler-store";

interface Props {
  normalizedName: string;
}

/**
 * The ruler toggle, in the top-right row just above the Draw toolbar. Hidden on
 * a map with no walking data: an estimate that ignored obstacles would be
 * worse than none.
 */
export function RulerControl({ normalizedName }: Props) {
  const on = useRulerStore((state) => state.on);
  const setOn = useRulerStore((state) => state.setOn);
  const ensureMarkerView = useEnsureMarkerView(normalizedName);
  if (!walkingRouteAvailable(normalizedName)) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-pressed={on}
      aria-label={on ? "Turn ruler off" : "Ruler: click two points to measure the walk"}
      title={
        on ? "Ruler on: click two points on the map" : "Ruler: measure the walk between two points"
      }
      onClick={() => {
        if (!on) ensureMarkerView();
        setOn(!on);
      }}
      className={
        on
          ? "border-primary bg-primary/20 text-primary shadow-sm backdrop-blur-sm"
          : "bg-background/90 shadow-sm backdrop-blur-sm"
      }
    >
      <Ruler className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
