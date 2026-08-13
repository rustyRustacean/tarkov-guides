"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ImageOverlay, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { useMapVariants } from "../hooks/use-map-variants";
import { containFitBounds, leafletBoundsFor, leafletCRSFor } from "../lib/leaflet-crs";
import { applyContainFitView } from "../lib/leaflet-view";
import {
  getMapConfig,
  resolveVariantId,
  variantHasAccurateMarkers,
  type MapVariant,
} from "../lib/map-config";
import { useMapSessionStore } from "../session/session-store";
import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

import { AnnotationCanvas } from "./AnnotationCanvas";
import { PlayerMarker } from "./PlayerMarker";
import { SessionPlayerMarkers } from "./SessionPlayerMarkers";
import { TaskMarkersLayer } from "./TaskMarkersLayer";

import type {
  CRS as LeafletCRS,
  ImageOverlay as LeafletImageOverlay,
  LatLngBoundsExpression,
  Map as LeafletMapInstance,
} from "leaflet";

interface Props {
  normalizedName: string;
}

interface MapImageryLayerProps {
  variant: MapVariant;
  bounds: LatLngBoundsExpression;
  crs: LeafletCRS;
  // `| undefined` (not just `?`) since callers pass `config.tileUrl` etc.
  // through explicitly rather than omitting the key; required under
  // `exactOptionalPropertyTypes`.
  tileUrl?: string | undefined;
  minNativeZoom?: number | undefined;
  maxNativeZoom?: number | undefined;
  // `naturalSize` is lifted to `MapContentLayers` so `TaskMarkersLayer` can
  // share the same contain-fit `imageBounds` a calibrated marker projects
  // into. `onNaturalSize` reports the loaded image's real dimensions back up.
  naturalSize: { width: number; height: number } | null;
  onNaturalSize: (size: { width: number; height: number }) => void;
}

/**
 * Renders one variant's actual imagery (tile layer or image overlay), plus
 * its own "image not sourced yet" fallback state. Split out so `imageFailed`/
 * `naturalSize` naturally reset when the variant/map changes: this
 * component is always mounted with the same `key` as its parent
 * `MapContainer`, so React discards and recreates its state on that
 * transition rather than needing an effect to reset it manually (this
 * project's `set-state-in-effect` lint rule forbids synchronous `setState`
 * in a bare effect body anyway).
 *
 * `bounds` (from `MAP_CONFIGS`) is calibrated to the tile pyramid /
 * interactive SVG's own footprint. A 2D/3D screenshot's native resolution
 * has no relation to it, so rendering it at those bounds unmodified visibly
 * stretches/squishes it. `naturalSize` (read off the real `<img>` once it
 * loads, via `getElement()`) feeds `containFitBounds` to correct for that;
 * until it's known, this falls back to the raw `bounds` rather than
 * blocking the first paint. Also applies the initial "contain fit" framing
 * (see `applyContainFitView`): once on mount using whatever bounds are
 * already known, and again once `naturalSize` resolves, since a
 * still-stretched-to-`bounds` fallback and the final aspect-correct image
 * can imply meaningfully different fit zoom levels.
 */
function MapImageryLayer({
  variant,
  bounds,
  crs,
  tileUrl,
  minNativeZoom,
  maxNativeZoom,
  naturalSize,
  onNaturalSize,
}: MapImageryLayerProps) {
  const map = useMap();
  const [imageFailed, setImageFailed] = useState(false);
  const useTiles = variant.interactive === true && tileUrl !== undefined;
  const imageBounds = containFitBounds(bounds, naturalSize, crs);

  // Recomputes `containFitBounds` itself rather than depending on the outer
  // `imageBounds` above: that value is a new array every render, which would
  // defeat this effect's whole purpose (refiring, and undoing the user's own
  // pan/zoom, on every unrelated re-render) if listed directly.
  useLayoutEffect(() => {
    applyContainFitView(map, useTiles ? bounds : containFitBounds(bounds, naturalSize, crs));
  }, [map, bounds, useTiles, naturalSize, crs]);

  return (
    <>
      {useTiles ? (
        <TileLayer
          url={tileUrl}
          minNativeZoom={minNativeZoom}
          maxNativeZoom={maxNativeZoom}
          tileSize={256}
        />
      ) : (
        <ImageOverlay
          url={variant.imageUrl}
          bounds={imageBounds}
          eventHandlers={{
            load: (event) => {
              const overlay = event.target as LeafletImageOverlay;
              const image = overlay.getElement();
              if (image) {
                onNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
              }
            },
            error: () => {
              setImageFailed(true);
            },
          }}
        />
      )}
      {imageFailed && (
        <div className="bg-background/95 pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center p-6 text-center">
          <p className="text-muted-foreground max-w-xs text-sm">
            Map image failed to load - see{" "}
            <code className="text-foreground">public/maps/SOURCES.md</code>.
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Owns the loaded image's `naturalSize` and derives the one contain-fit
 * `imageBounds` both the `ImageOverlay` and (for a calibrated variant) the
 * markers must share to stay aligned. Lives inside the keyed `MapContainer`
 * so it remounts per map/variant, resetting `naturalSize` on its own without
 * a synchronous set-state effect (forbidden by this project's lint rule).
 */
function MapContentLayers({
  normalizedName,
  variant,
  bounds,
  crs,
  tileUrl,
  minNativeZoom,
  maxNativeZoom,
  coordinateRotation,
}: {
  normalizedName: string;
  variant: MapVariant;
  bounds: LatLngBoundsExpression;
  crs: LeafletCRS;
  tileUrl?: string | undefined;
  minNativeZoom?: number | undefined;
  maxNativeZoom?: number | undefined;
  coordinateRotation: number;
}) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const useTiles = variant.interactive === true && tileUrl !== undefined;
  const imageBounds = useTiles ? bounds : containFitBounds(bounds, naturalSize, crs);
  const calibratedImageBounds = variant.calibration ? imageBounds : undefined;
  // Markers only render on variants where they're accurately placed (see
  // `variantHasAccurateMarkers`); hidden on uncalibrated 2D/3D variants.
  const showMarkers = variantHasAccurateMarkers(variant);

  return (
    <>
      <MapImageryLayer
        variant={variant}
        bounds={bounds}
        crs={crs}
        tileUrl={tileUrl}
        minNativeZoom={minNativeZoom}
        maxNativeZoom={maxNativeZoom}
        naturalSize={naturalSize}
        onNaturalSize={setNaturalSize}
      />
      {showMarkers && (
        <>
          <TaskMarkersLayer
            normalizedMapName={normalizedName}
            calibration={variant.calibration}
            imageBounds={calibratedImageBounds}
          />
          <PlayerMarker
            normalizedName={normalizedName}
            calibration={variant.calibration}
            imageBounds={calibratedImageBounds}
            coordinateRotation={coordinateRotation}
          />
          <SessionPlayerMarkers
            normalizedName={normalizedName}
            calibration={variant.calibration}
            imageBounds={calibratedImageBounds}
            coordinateRotation={coordinateRotation}
          />
        </>
      )}
    </>
  );
}

const VIEW_BROADCAST_THROTTLE_MS = 150;

interface SessionViewSyncLatest {
  isController: boolean;
  normalizedMapName: string;
  variantId: string;
}

/**
 * Keeps the shared session view in sync with this map's actual Leaflet
 * viewport: the controller's own pan/zoom broadcasts out (throttled), and a
 * follower's incoming view is applied back. Rendered as a `MapContainer`
 * child (like `MapImageryLayer`) so it can use `useMap()`; a no-op render
 * (`return null`) since it only wires side effects, never renders anything.
 *
 * Handlers are created once via `useState`'s lazy initializer, reading
 * render-dependent values through a ref instead of closing over them
 * directly. `AnnotationCanvas.tsx` found via a real browser test that
 * `useMapEvents` tears down and resubscribes its native listeners whenever
 * its handlers object identity changes, which can silently drop events; this
 * mirrors that same fix.
 */
function SessionViewSync({
  normalizedMapName,
  variantId,
}: {
  normalizedMapName: string;
  variantId: string;
}) {
  const map = useMap();
  const session = useMapsSession();
  const followHostView = useMapSessionStore((state) => state.followHostView);

  const latestRef = useRef<SessionViewSyncLatest>({
    isController: session.isController,
    normalizedMapName,
    variantId,
  });
  useEffect(() => {
    latestRef.current = { isController: session.isController, normalizedMapName, variantId };
  });

  const setViewRef = useRef(session.setView);
  useEffect(() => {
    setViewRef.current = session.setView;
  });

  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function broadcastIfController(): void {
    if (!latestRef.current.isController) return;
    if (throttleTimerRef.current) return;
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
    }, VIEW_BROADCAST_THROTTLE_MS);
    const center = map.getCenter();
    setViewRef.current({
      mapNormalizedName: latestRef.current.normalizedMapName,
      variantId: latestRef.current.variantId,
      center: { lat: center.lat, lng: center.lng },
      zoom: map.getZoom(),
    });
  }

  const [handlers] = useState(() => ({
    moveend() {
      broadcastIfController();
    },
    zoomend() {
      broadcastIfController();
    },
  }));

  useMapEvents(handlers);

  // Follower: apply the incoming shared view. A map/variant mismatch means
  // the host switched maps: update the local selection first (this remounts
  // this whole `MapContainer` subtree for the new map on the next render,
  // per its `key={normalizedName:variant.id}` below) rather than trying to
  // `setView` coordinates that belong to a different map's CRS/bounds.
  //
  // `followHostView` only gates the last step, the pan/zoom. Which map and
  // variant everyone is on stays synced either way: drifting onto a different
  // map silently would make the shared drawings and partner markers look
  // wrong, whereas free-roaming the viewport is exactly what the toggle is
  // for: reading a corner of the map while the host is looking elsewhere.
  useEffect(() => {
    if (!session.active || session.isController) return;
    const view = session.view;
    if (!view) return;
    if (view.mapNormalizedName !== normalizedMapName) {
      useMapsStore.getState().setCurrentMap(view.mapNormalizedName);
      return;
    }
    if (view.variantId !== variantId) {
      useMapsStore.getState().setMapVariant(view.mapNormalizedName, view.variantId);
      return;
    }
    if (!followHostView) return;
    map.setView([view.center.lat, view.center.lng], view.zoom);
  }, [
    session.active,
    session.isController,
    session.view,
    normalizedMapName,
    variantId,
    map,
    followHostView,
  ]);

  return null;
}

/**
 * The core map viewport: every variant (tile-backed "Satellite View" and
 * every static overview/2D/3D image) renders through one `react-leaflet`
 * `MapContainer`, using `ImageOverlay` for variants without a live tile
 * pyramid instead of porting legacy's separate hand-rolled CSS-transform
 * pan/zoom system for static images (see `src/features/maps/README.md`).
 * Uses Leaflet's own default wheel-zoom; legacy's elaborate velocity-eased,
 * anti-flicker custom zoom is deliberately not ported (orthogonal to
 * correctness, a possible later polish-only follow-up). Also mounts
 * `AnnotationCanvas` (the drawing tool, including its own toolbar overlay)
 * alongside `TaskMarkersLayer`: both are self-contained feature panels
 * that read/write `useMapsStore` themselves. `SessionViewSync` similarly
 * mounts unconditionally and no-ops when no collaborative session is active.
 */
export function MapViewer({ normalizedName }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);

  // Any layout shift that resizes this component's box (fullscreen toggle,
  // the right panel collapsing, the mobile sheet's live drag) leaves
  // Leaflet's internal size cache stale until `invalidateSize()` runs. A
  // `ResizeObserver` on our own root, rather than fullscreen/collapse/sheet
  // callbacks threaded down from a parent, keeps this component self-
  // contained and handles every future layout-shift source the same way.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, []);

  const config = getMapConfig(normalizedName);
  const variants = useMapVariants(normalizedName, config?.variants ?? []);
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  // Memoized (keyed on `config`, a stable reference from the static
  // `MAP_CONFIGS` table for a given map) so `MapImageryLayer`'s own
  // `useLayoutEffect` (which depends on `bounds` to know when to re-apply
  // the contain-fit view) doesn't refire on every unrelated re-render of
  // this component and undo the user's manual pan/zoom. The `[[0,0],[0,0]]`
  // fallback is never actually rendered; it only exists so `bounds` stays
  // non-null before the `!config` check below, which itself takes an early
  // return.
  const bounds = useMemo<LatLngBoundsExpression>(
    () =>
      config
        ? leafletBoundsFor(config)
        : [
            [0, 0],
            [0, 0],
          ],
    [config],
  );
  // Memoized alongside `bounds` for the same reason: `MapImageryLayer`
  // passes both into `containFitBounds`, whose own callers depend on a
  // stable reference to avoid refiring `applyContainFitView` (and undoing
  // the user's pan/zoom) on every unrelated re-render.
  const crs = useMemo(() => (config ? leafletCRSFor(config) : L.CRS.Simple), [config]);

  if (!config) {
    return (
      <p className="text-muted-foreground p-6 text-sm">Unknown map: &quot;{normalizedName}&quot;</p>
    );
  }

  const variantId = resolveVariantId(variants, storedVariantId ?? null);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  if (!variant) {
    return (
      <p className="text-muted-foreground p-6 text-sm">This map has no variants configured.</p>
    );
  }

  return (
    <div
      ref={rootRef}
      className="map-viewer bg-background relative h-full w-full overflow-hidden rounded-lg"
    >
      <MapContainer
        ref={mapRef}
        key={`${normalizedName}:${variant.id}`}
        crs={crs}
        bounds={bounds}
        minZoom={config.minZoom}
        maxZoom={config.maxZoom}
        maxBounds={bounds}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <MapContentLayers
          normalizedName={normalizedName}
          variant={variant}
          bounds={bounds}
          crs={crs}
          tileUrl={config.tileUrl}
          minNativeZoom={config.minNativeZoom}
          maxNativeZoom={config.maxNativeZoom}
          coordinateRotation={config.coordinateRotation ?? 0}
        />
        <AnnotationCanvas
          normalizedMapName={normalizedName}
          variantId={variant.id}
          bounds={bounds}
        />
        <SessionViewSync normalizedMapName={normalizedName} variantId={variant.id} />
      </MapContainer>
    </div>
  );
}
