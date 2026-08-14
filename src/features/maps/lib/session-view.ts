import type { SessionView } from "../session/liveblocks-config";
import type { LatLngBoundsLiteral } from "leaflet";

/**
 * What a follower should do to match the controller's view.
 *
 * Prefers the shared visible EXTENT over the controller's zoom level. A
 * Leaflet zoom level is an absolute pixels-per-coordinate scale, so applying
 * the host's level to a different-sized container shows a different amount of
 * map - the reason a joiner on a smaller window ended up far more zoomed in
 * than the host on the same "view". Fitting the host's bounds to each
 * container instead makes everyone see the same region, whatever their screen.
 *
 * Falls back to center+zoom when `bounds` is absent (a participant still
 * running a build that never published it), which is the old behaviour and
 * still better than ignoring the view entirely.
 */
export type SharedViewTarget =
  | { kind: "bounds"; bounds: LatLngBoundsLiteral }
  | { kind: "center"; center: [number, number]; zoom: number };

/** Resolves a shared view into the concrete framing a follower should apply. */
export function sharedViewTarget(view: SessionView): SharedViewTarget {
  const b = view.bounds;
  if (
    b &&
    Number.isFinite(b.north) &&
    Number.isFinite(b.south) &&
    Number.isFinite(b.east) &&
    Number.isFinite(b.west) &&
    // A zero-area rectangle can't be fitted to anything meaningful - Leaflet
    // would snap to max zoom on a single point.
    b.north !== b.south &&
    b.east !== b.west
  ) {
    return {
      kind: "bounds",
      bounds: [
        [b.south, b.west],
        [b.north, b.east],
      ],
    };
  }
  return { kind: "center", center: [view.center.lat, view.center.lng], zoom: view.zoom };
}
