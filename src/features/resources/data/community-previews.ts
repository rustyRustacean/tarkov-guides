import previews from "./community-previews.json";

/**
 * A captured screenshot of a community site, written by
 * `scripts/capture-community-previews.mjs` into `community-previews.json`.
 * Never edit the JSON by hand; re-run the script.
 */
export interface CommunityPreview {
  /** The page that was captured. Must equal the resource's `url`. */
  url: string;
  /** Path under `public/`. */
  src: string;
  width: number;
  height: number;
  /** True when the page was at least two screens tall, so the card pans through it on hover. */
  scroll: boolean;
  /** `YYYY-MM-DD`. */
  capturedAt: string;
}

/** Every captured preview, keyed by `CommunityResource.id`. */
export const COMMUNITY_PREVIEWS: Readonly<Record<string, CommunityPreview>> = previews;

/** The most recent capture date across `previewMap`, as `YYYY-MM`, or `null` when there are none. */
export function latestCaptureMonth(
  previewMap: Readonly<Record<string, CommunityPreview>>,
): string | null {
  const dates = Object.values(previewMap).map((preview) => preview.capturedAt);
  if (dates.length === 0) return null;
  return dates.sort().at(-1)?.slice(0, 7) ?? null;
}
