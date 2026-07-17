"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { ImageOverlay, MapContainer, TileLayer } from "react-leaflet";

import { useMapVariants } from "../hooks/use-map-variants";
import { leafletBoundsFor, leafletCRSFor } from "../lib/leaflet-crs";
import { getMapConfig, type MapVariant } from "../lib/map-config";
import { useMapsStore } from "../store";

import { AnnotationCanvas } from "./AnnotationCanvas";
import { TaskMarkersLayer } from "./TaskMarkersLayer";

import type { LatLngBoundsExpression, Map as LeafletMapInstance } from "leaflet";

interface Props {
  normalizedName: string;
}

/**
 * Legacy prefers `overview` as the first-visit default variant - its own
 * comment explains why: "the calibrated SVG with working task pins" (see
 * `mapHeader.js`'s `goMap()`). Falls back to whichever variant is listed
 * first if a map has no `overview` entry (e.g. `icebreaker`).
 */
function defaultVariantId(variants: readonly MapVariant[]): string {
  return variants.find((variant) => variant.id === "overview")?.id ?? variants[0]?.id ?? "overview";
}

interface MapImageryLayerProps {
  variant: MapVariant;
  bounds: LatLngBoundsExpression;
  // `| undefined` (not just `?`) since callers pass `config.tileUrl` etc.
  // through explicitly rather than omitting the key - required under
  // `exactOptionalPropertyTypes`.
  tileUrl?: string | undefined;
  minNativeZoom?: number | undefined;
  maxNativeZoom?: number | undefined;
}

/**
 * Renders one variant's actual imagery (tile layer or image overlay), plus
 * its own "image not sourced yet" fallback state. Split out so `imageFailed`
 * naturally resets when the variant/map changes - this component is always
 * mounted with the same `key` as its parent `MapContainer`, so React
 * discards and recreates its state on that transition rather than needing
 * an effect to reset it manually (this project's `set-state-in-effect`
 * lint rule forbids synchronous `setState` in a bare effect body anyway).
 */
function MapImageryLayer({
  variant,
  bounds,
  tileUrl,
  minNativeZoom,
  maxNativeZoom,
}: MapImageryLayerProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const useTiles = variant.interactive === true && tileUrl !== undefined;

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
          bounds={bounds}
          eventHandlers={{
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
 * The core map viewport - every variant (tile-backed "Interactable" and
 * every static overview/2D/3D image) renders through one `react-leaflet`
 * `MapContainer`, using `ImageOverlay` for variants without a live tile
 * pyramid instead of porting legacy's separate hand-rolled CSS-transform
 * pan/zoom system for static images (see `src/features/maps/README.md`).
 * Uses Leaflet's own default wheel-zoom - legacy's elaborate velocity-eased,
 * anti-flicker custom zoom is deliberately not ported (orthogonal to
 * correctness, a possible later polish-only follow-up). Also mounts
 * `AnnotationCanvas` (the drawing tool, including its own toolbar overlay)
 * alongside `TaskMarkersLayer` - both are self-contained feature panels
 * that read/write `useMapsStore` themselves.
 */
export function MapViewer({ normalizedName }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);

  // Any layout shift that resizes this component's box - fullscreen toggle,
  // the right panel collapsing, the mobile sheet's live drag - leaves
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

  if (!config) {
    return (
      <p className="text-muted-foreground p-6 text-sm">Unknown map: &quot;{normalizedName}&quot;</p>
    );
  }

  const variantId = storedVariantId ?? defaultVariantId(variants);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  if (!variant) {
    return (
      <p className="text-muted-foreground p-6 text-sm">This map has no variants configured.</p>
    );
  }

  const bounds = leafletBoundsFor(config);

  return (
    <div ref={rootRef} className="bg-background relative h-full w-full overflow-hidden rounded-lg">
      <MapContainer
        ref={mapRef}
        key={`${normalizedName}:${variant.id}`}
        crs={leafletCRSFor(config)}
        bounds={bounds}
        minZoom={config.minZoom}
        maxZoom={config.maxZoom}
        maxBounds={bounds}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <MapImageryLayer
          variant={variant}
          bounds={bounds}
          tileUrl={config.tileUrl}
          minNativeZoom={config.minNativeZoom}
          maxNativeZoom={config.maxNativeZoom}
        />
        <TaskMarkersLayer normalizedMapName={normalizedName} />
        <AnnotationCanvas
          normalizedMapName={normalizedName}
          variantId={variant.id}
          bounds={bounds}
        />
      </MapContainer>
    </div>
  );
}
