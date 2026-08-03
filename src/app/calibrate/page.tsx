import { notFound } from "next/navigation";

import CalibrateTool from "./CalibrateTool";

/**
 * Production gate for the TEMPORARY map-calibration tool (`CalibrateTool.tsx`
 * - not part of the app, see its own doc comment). Pre-production audit
 * (`CODE_AUDIT.md` finding 2) found this route shipping as a real, publicly
 * reachable `/calibrate` URL despite carrying zero inbound links and its own
 * "delete this whole folder when calibration is finished" comment.
 * Deleting it outright was rejected: only 1 of 25 static 2D/3D map variants
 * is calibrated so far (`features/maps/lib/map-config.ts`'s `calibration`
 * blocks), and `variantHasAccurateMarkers` still hides quest markers on the
 * other 24 pending that work - this route is the only means of finishing it.
 * A server-side `notFound()` gate keeps it fully usable under `next dev`/
 * `next start` (`NODE_ENV !== "production"`) while making it unreachable in
 * a real production build/deploy. Split into a server page (this file, the
 * gate) + a client component (`CalibrateTool`, all the actual interactive
 * logic) rather than checking `NODE_ENV` inside a "use client" component,
 * since `notFound()` is documented for Server Components/Route Handlers.
 */
export default function CalibratePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <CalibrateTool />;
}
