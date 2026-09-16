import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { ANONYMOUS_PROFILE_ID, useMapsStore } from "../store";
import { emptyMapProfileState } from "../types";

import { AnnotationCanvas } from "./AnnotationCanvas";

import type { MapAnnotationLayer } from "../types";
import type { LatLngBoundsExpression } from "leaflet";
import type { ReactElement } from "react";

// This file exercises the pre-existing local/solo annotation path only. A
// live collaborative session's own behavior (session-backed layer, author-
// restricted undo) is covered separately by
// `session/use-session-annotation-layer.test.ts`. Mocking this hook to
// always report "no session active" both keeps that scope clean and avoids
// needing a real `RoomProvider` ancestor just to render this component.
vi.mock("../session/use-session-annotation-layer", () => ({
  useSessionAnnotationLayer: () => null,
}));

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

/** Counts every rendered path (strokes are deliberately `interactive={false}`, see `AnnotationCanvas.tsx`'s doc comment, so `.leaflet-interactive` alone would miss them). */
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
  it("enables the Draw toggle with no active profile and no session (drawing falls back to the anonymous bucket)", () => {
    renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(screen.getByRole("button", { name: /draw/i })).toBeEnabled();
  });

  it("renders strokes from the local (no-profile) bucket keyed by ANONYMOUS_PROFILE_ID", () => {
    useMapsStore.setState({
      profileState: {
        [ANONYMOUS_PROFILE_ID]: {
          ...emptyMapProfileState(),
          annotations: {
            reserve: {
              overview: {
                strokes: [
                  { id: "s1", type: "pen", color: "#ff3b3b", width: 4, points: [{ fx: 0, fy: 0 }] },
                ],
              },
            },
          },
        },
      },
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(1);
  });

  it("enables the Draw toggle once a profile exists, and toggling it reveals the tool buttons", async () => {
    createProfileWithLayer({ strokes: [] });
    renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );

    const drawButton = screen.getByRole("button", { name: /draw/i });
    expect(drawButton).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pen" })).not.toBeInTheDocument();

    await userEvent.click(drawButton);
    expect(screen.getByRole("button", { name: "Pen" })).toBeInTheDocument();
  });

  it("renders every stored stroke (pen, circle, rect) as a Leaflet path", () => {
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
        {
          id: "s3",
          type: "rect",
          color: "#ffd83b",
          width: 3,
          corner1: { fx: 0.1, fy: 0.1 },
          corner2: { fx: 0.3, fy: 0.3 },
          rotation: 0,
        },
      ],
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="overview" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(3);
  });

  it("renders no strokes for a different map/variant than the one requested", () => {
    createProfileWithLayer({
      strokes: [{ id: "s1", type: "pen", color: "#ff3b3b", width: 4, points: [{ fx: 0, fy: 0 }] }],
    });
    const { container } = renderInsideMap(
      <AnnotationCanvas normalizedMapName="reserve" variantId="2d" bounds={BOUNDS} />,
    );
    expect(pathCount(container)).toBe(0);
  });
});
