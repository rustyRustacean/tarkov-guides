import L from "leaflet";
import { afterEach, describe, expect, it } from "vitest";

import { applyFillWidthView } from "./leaflet-view";

let activeMaps: L.Map[] = [];
let activeContainers: HTMLDivElement[] = [];

/** jsdom reports 0 for `clientWidth`/`clientHeight` by default - Leaflet's own `getSize()` reads those directly, so a real pixel size has to be stubbed in for `applyFillWidthView` (container-width-driven) to do anything. */
function makeMap(
  containerWidth: number,
  containerHeight: number,
  options: L.MapOptions = {},
): L.Map {
  const container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: containerWidth, configurable: true });
  Object.defineProperty(container, "clientHeight", { value: containerHeight, configurable: true });
  document.body.appendChild(container);
  activeContainers.push(container);

  const map = L.map(container, { crs: L.CRS.Simple, center: [0, 0], zoom: 0, ...options });
  activeMaps.push(map);
  return map;
}

afterEach(() => {
  for (const map of activeMaps) map.remove();
  for (const container of activeContainers) container.remove();
  activeMaps = [];
  activeContainers = [];
});

describe("applyFillWidthView", () => {
  it("no-ops when the container has no real size", () => {
    const map = makeMap(0, 0);
    const zoomBefore = map.getZoom();
    const centerBefore = map.getCenter();

    applyFillWidthView(map, [
      [-50, -50],
      [50, 50],
    ]);

    expect(map.getZoom()).toBe(zoomBefore);
    expect(map.getCenter()).toEqual(centerBefore);
  });

  it("zooms so the bounds' width exactly fills the container's width", () => {
    // Chosen so the ideal target zoom (log2(800/100) = 3) lands exactly on
    // a whole number - `applyFillWidthView`'s `zoomSnap` loosening only
    // takes effect under `Browser.any3d` (real CSS-3D-transform support),
    // which jsdom reports as `false`; a non-whole target zoom would get
    // silently rounded to the nearest integer in this test environment
    // even though it wouldn't in a real browser, masking what this test is
    // actually meant to check.
    const map = makeMap(800, 400, { minZoom: -10, maxZoom: 10 });

    applyFillWidthView(map, [
      [-50, -50],
      [50, 50],
    ]);

    expect(map.getZoom()).toBe(3);
    const west = map.latLngToContainerPoint([0, -50]);
    const east = map.latLngToContainerPoint([0, 50]);
    expect(east.x - west.x).toBeCloseTo(800, 0);
  });

  it("centers the view on the bounds' center, not the map's previous center", () => {
    const map = makeMap(800, 600, { center: [999, 999], zoom: 0, minZoom: -10, maxZoom: 10 });

    applyFillWidthView(map, [
      [-10, 20],
      [10, 40],
    ]);

    expect(map.getCenter().lat).toBeCloseTo(0, 6);
    expect(map.getCenter().lng).toBeCloseTo(30, 6);
  });

  it("clamps the resulting zoom to the map's configured max zoom", () => {
    // A huge container against a tiny box would otherwise compute a zoom
    // far past what the map (and this map's tile/image layers) support.
    const map = makeMap(5000, 5000, { minZoom: 0, maxZoom: 2 });

    applyFillWidthView(map, [
      [-1, -1],
      [1, 1],
    ]);

    expect(map.getZoom()).toBe(2);
  });

  it("clamps the resulting zoom to the map's configured min zoom", () => {
    const map = makeMap(10, 10, { minZoom: 1, maxZoom: 10 });

    applyFillWidthView(map, [
      [-500, -500],
      [500, 500],
    ]);

    expect(map.getZoom()).toBe(1);
  });

  it("fills correctly for a rotated/non-square bounding box (measures the projected corner bbox)", () => {
    const map = makeMap(1200, 300, { minZoom: -10, maxZoom: 10 });

    // A "rotated" box expressed as an asymmetric bounds - width dominates.
    applyFillWidthView(map, [
      [-25, -600],
      [25, 600],
    ]);

    const west = map.latLngToContainerPoint([0, -600]);
    const east = map.latLngToContainerPoint([0, 600]);
    expect(east.x - west.x).toBeCloseTo(1200, 0);
  });
});
