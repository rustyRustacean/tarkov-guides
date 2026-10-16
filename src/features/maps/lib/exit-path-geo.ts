import { latLngToFractional, type VariantCalibration } from "./leaflet-crs";

import type { Point } from "./exit-path";
import type { LatLng, LatLngBoundsExpression } from "leaflet";

/**
 * The game-space point a map click landed on: the inverse of `gameCenter`.
 *
 * On the shared game-space CRS Leaflet's `[lat, lng]` is `[z, x]`. On a
 * calibrated variant the click is converted to the image's fractional space
 * and the variant's affine (`fx = a*x + b*z + c`, `fy = d*x + e*z + f`) is
 * solved for `x`/`z`.
 */
export function gamePointFromLatLng(
  latLng: LatLng,
  calibration: VariantCalibration | undefined,
  bounds: LatLngBoundsExpression | undefined,
): Point {
  if (calibration && bounds) {
    const { fx, fy } = latLngToFractional(latLng, bounds);
    const det = calibration.a * calibration.e - calibration.b * calibration.d;
    if (Math.abs(det) > 1e-12) {
      const rx = fx - calibration.c;
      const ry = fy - calibration.f;
      return {
        x: (calibration.e * rx - calibration.b * ry) / det,
        z: (calibration.a * ry - calibration.d * rx) / det,
      };
    }
  }
  return { x: latLng.lng, z: latLng.lat };
}
