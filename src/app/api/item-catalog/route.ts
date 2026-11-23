import { NextResponse } from "next/server";

import {
  buildItemCatalog,
  type CatalogSourceData,
} from "@/features/events/catalog/build-item-catalog";
import { fetchTranslatedJsonResource } from "@/shared/lib/tarkov-api/fetch-json-resource";

/**
 * Cached for 12 hours, like `/api/tarkov-data`, and for the same reason:
 * upstream load stays fixed however many people use the preset builder.
 * Item categories don't change between game modes, so this reads the
 * regular-mode items only.
 */
export const revalidate = 43200;

/**
 * The item catalog for event presets and the kit checker: the handbook
 * category tree with icons, and each item's category and limitable stats
 * (`buildItemCatalog`). Its own route rather than part of the main game
 * dataset, which every page loads, because only the events pages use it.
 */
export async function GET() {
  try {
    const data = await fetchTranslatedJsonResource<CatalogSourceData>("items", "regular");
    return NextResponse.json(buildItemCatalog(data));
  } catch {
    return NextResponse.json(
      { error: "unavailable", reason: "The item catalog is unavailable right now." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
