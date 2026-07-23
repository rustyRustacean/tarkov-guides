import { render, screen } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useSessionAnnotationLayer } from "../session/use-session-annotation-layer";
import { useMapsStore } from "../store";

import { AnnotationCanvas } from "./AnnotationCanvas";

import type { LatLngBoundsExpression } from "leaflet";
import type { ReactElement } from "react";

vi.mock("../session/use-session-annotation-layer", () => ({
  useSessionAnnotationLayer: vi.fn(),
}));

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

const BOUNDS: LatLngBoundsExpression = [
  [-100, -100],
  [100, 100],
];

function renderInsideMap(ui: ReactElement) {
  return render(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      {ui}
    </MapContainer>,
  );
}

function pathCount(container: HTMLElement): number {
  return container.querySelectorAll(".leaflet-overlay-pane path").length;
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
  vi.mocked(useSessionAnnotationLayer).mockReset();
});

describe("AnnotationCanvas with an active collaborative session", () => {
  it("draws from the session layer, not the local per-profile one, even with no active profile", () => {
    vi.mocked(useSessionAnnotationLayer).mockReturnValue({
      layer: {
        strokes: [
          {
            id: "s1",
            type: "pen",
            color: "#ff3b3b",
            width: 4,
            points: [
              { fx: 0.1, fy: 0.1 },
              { fx: 0.2, fy: 0.2 },
            ],
          },
        ],
        locks: [],
      },
      authorId: "participant-1",
      onChangeLayer: vi.fn(),
    });

    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(1);
  });

  it("enables the Draw toggle during a session even with no active local profile", () => {
    vi.mocked(useSessionAnnotationLayer).mockReturnValue({
      layer: { strokes: [], locks: [] },
      authorId: "participant-1",
      onChangeLayer: vi.fn(),
    });

    renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(screen.getByRole("button", { name: /draw/i })).toBeEnabled();
  });
});
