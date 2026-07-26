import L from "leaflet";
import { afterEach, describe, expect, it } from "vitest";

import { applyContainFitView } from "./leaflet-view";

let activeMaps: L.Map[] = [];
let activeContainers: HTMLDivElement[] = [];

/** jsdom reports 0 for `clientWidth`/`clientHeight` by default - Leaflet's own `getSize()` reads those directly, so a real pixel size has to be stubbed in for `applyContainFitView` (container-size-driven) to do anything. */
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

describe("applyContainFitView", () => {
  it("no-ops when the container has no real size", () => {
    const map = makeMap(0, 0);
    const zoomBefore = map.getZoom();
    const centerBefore = map.getCenter();

    applyContainFitView(map, [
      [-50, -50],
      [50, 50],
    ]);

    expect(map.getZoom()).toBe(zoomBefore);
    expect(map.getCenter()).toEqual(centerBefore);
  });

  it("zooms so a square box fits entirely within a wider-than-tall container, letterboxing left/right rather than filling the width", () => {
    // Chosen so the ideal target zoom (log2(400/100) = 2, the
    // height-constrained fit) lands exactly on a whole number -
    // `applyContainFitView`'s `zoomSnap` loosening only takes effect under
    // `Browser.any3d` (real CSS-3D-transform support), which jsdom reports
    // as `false`; a non-whole target zoom would get silently rounded to the
    // nearest integer in this test environment even though it wouldn't in a
    // real browser, masking what this test is actually meant to check. A
    // naive fill-width fit would instead pick zoom 3 (filling all 800px of
    // width) and cut the box's height in half - exactly the crop this
    // function exists to avoid.
    const map = makeMap(800, 400, { minZoom: -10, maxZoom: 10 });

    applyContainFitView(map, [
      [-50, -50],
      [50, 50],
    ]);

    expect(map.getZoom()).toBe(2);
    const north = map.latLngToContainerPoint([50, 0]);
    const south = map.latLngToContainerPoint([-50, 0]);
    expect(south.y - north.y).toBeCloseTo(400, 0);
    const west = map.latLngToContainerPoint([0, -50]);
    const east = map.latLngToContainerPoint([0, 50]);
    expect(east.x - west.x).toBeLessThan(800);
  });

  it("does not crop a box that's taller (relative to its width) than the container", () => {
    // A portrait-leaning box (50 wide x 200 tall) inside a landscape
    // container - a fill-width fit would zoom to fill the 800px width
    // (zoom 4) and push most of the box's height off-screen. Contain-fit
    // must instead pick the height-constrained zoom (log2(400/200) = 1) so
    // the whole box stays visible, letterboxed left/right instead.
    const map = makeMap(800, 400, { minZoom: -10, maxZoom: 10 });

    applyContainFitView(map, [
      [-100, -25],
      [100, 25],
    ]);

    expect(map.getZoom()).toBe(1);
    const north = map.latLngToContainerPoint([100, 0]);
    const south = map.latLngToContainerPoint([-100, 0]);
    expect(south.y - north.y).toBeCloseTo(400, 0);
  });

  it("centers the view on the bounds' center, not the map's previous center", () => {
    const map = makeMap(800, 600, { center: [999, 999], zoom: 0, minZoom: -10, maxZoom: 10 });

    applyContainFitView(map, [
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

    applyContainFitView(map, [
      [-1, -1],
      [1, 1],
    ]);

    expect(map.getZoom()).toBe(2);
  });

  it("clamps the resulting zoom to the map's configured min zoom", () => {
    const map = makeMap(10, 10, { minZoom: 1, maxZoom: 10 });

    applyContainFitView(map, [
      [-500, -500],
      [500, 500],
    ]);

    expect(map.getZoom()).toBe(1);
  });

  it("fits correctly for a rotated/non-square bounding box (measures the projected corner bbox)", () => {
    const map = makeMap(1200, 300, { minZoom: -10, maxZoom: 10 });

    // A "rotated" box expressed as an asymmetric bounds - width is already
    // the more-constraining axis, so contain-fit picks the same zoom a
    // width-only fit would have.
    applyContainFitView(map, [
      [-25, -600],
      [25, 600],
    ]);

    const west = map.latLngToContainerPoint([0, -600]);
    const east = map.latLngToContainerPoint([0, 600]);
    expect(east.x - west.x).toBeCloseTo(1200, 0);
  });
});
