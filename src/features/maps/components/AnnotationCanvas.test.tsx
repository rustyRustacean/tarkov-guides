import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useMapsStore } from "../store";
import { emptyMapProfileState } from "../types";

import { AnnotationCanvas } from "./AnnotationCanvas";

import type { MapAnnotationLayer } from "../types";
import type { LatLngBoundsExpression } from "leaflet";
import type { ReactElement } from "react";

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

const BOUNDS: LatLngBoundsExpression = [
  [-100, -100],
  [100, 100],
];

/** Leaflet vector layers (Polyline/Circle/Rectangle) require a real MapContainer ancestor to mount. */
function renderInsideMap(ui: ReactElement) {
  return render(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      {ui}
    </MapContainer>,
  );
}

/** Counts every rendered path, not just `.leaflet-interactive` ones - strokes are deliberately `interactive={false}` (see `AnnotationCanvas.tsx`'s doc comment), so only committed lock rectangles carry that class. */
function pathCount(container: HTMLElement): number {
  return container.querySelectorAll(".leaflet-overlay-pane path").length;
}

function createProfileWithLayer(layer: MapAnnotationLayer): string {
  const profileId = useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
  useMapsStore.setState({
    profileState: {
      [profileId]: {
        ...emptyMapProfileState(),
        annotations: { reserve: { overview: layer } },
      },
    },
  });
  return profileId;
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
});

describe("AnnotationCanvas", () => {
  it("disables the Draw toggle when there is no active profile", () => {
    renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(screen.getByRole("button", { name: /draw/i })).toBeDisabled();
  });

  it("enables the Draw toggle once a profile exists, and toggling it reveals the tool buttons", async () => {
    createProfileWithLayer({ strokes: [], locks: [] });
    renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );

    const drawButton = screen.getByRole("button", { name: /draw/i });
    expect(drawButton).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pen" })).not.toBeInTheDocument();

    await userEvent.click(drawButton);
    expect(screen.getByRole("button", { name: "Pen" })).toBeInTheDocument();
  });

  it("renders every stored stroke as a Leaflet path", () => {
    createProfileWithLayer({
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
        {
          id: "s2",
          type: "circle",
          color: "#3b86ff",
          width: 4,
          center: { fx: 0.5, fy: 0.5 },
          edge: { fx: 0.6, fy: 0.5 },
        },
      ],
      locks: [],
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(2);
  });

  it("renders no strokes for a different map/variant than the one requested", () => {
    createProfileWithLayer({
      strokes: [{ id: "s1", type: "pen", color: "#ff3b3b", width: 4, points: [{ fx: 0, fy: 0 }] }],
      locks: [],
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="2d" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(0);
  });

  it("only renders lock rectangles while draw mode is on", async () => {
    createProfileWithLayer({
      strokes: [],
      locks: [{ id: "l1", corner1: { fx: 0.1, fy: 0.1 }, corner2: { fx: 0.3, fy: 0.3 } }],
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: /draw/i }));
    expect(pathCount(container)).toBe(1);
  });
});
