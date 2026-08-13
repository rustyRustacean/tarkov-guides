import { JSONPath } from "jsonpath-plus";

/**
 * One `resultType: "all"` match. `jsonpath-plus`'s own `.d.ts` types this
 * (and its `json`/`path` inputs) as `any` throughout, so this interface is
 * this module's own boundary back into real types.
 */
interface JsonPathMatch {
  value: unknown;
  parent: Record<string, unknown>;
  parentProperty: string;
}

/**
 * Applies a tarkov.dev JSON API translation dictionary to a fetched
 * envelope, in place. Ported from tarkov-dev's own reference client
 * (`the-hideout/tarkov-dev`'s `src/modules/api-request.mjs`), confirmed
 * directly with a tarkov.dev staff member as the intended mechanism: each
 * string in `translationPaths` is a JSONPath (e.g. `$.data.items.*.name`)
 * identifying fields whose current value is a **translation key**, not real
 * text; `dict[key]` is the actual localized string.
 *
 * Deliberately walks only the exact JSONPath locations `translationPaths`
 * names, rather than a blind "replace any string that happens to match a
 * dictionary key, wherever it appears" pass. Confirmed via a real live
 * task that this distinction matters: an objective's `id` and its
 * `description` can hold the identical placeholder string pre-translation
 * (both derived from the same underlying key), so a blind replace would
 * have also silently overwritten the objective's real id.
 *
 * `envelope` must be the FULL `{data: ..., translations: ...}` object, not
 * just its `data` section: `translationPaths` entries are rooted at `$`
 * and include the literal `data.` prefix (e.g. `$.data.items.*.name`).
 *
 * @param dict - Resolved translation strings for this resource+language. A key with no entry here (translation genuinely missing) is left as its original placeholder value, matching the reference client's own `dict[key] ?? key` fallback.
 */
export function applyTranslations<T extends { data: unknown }>(
  envelope: T,
  translationPaths: readonly string[],
  dict: Record<string, string>,
): T {
  for (const path of translationPaths) {
    const matches = JSONPath<JsonPathMatch[]>({
      path,
      json: envelope,
      resultType: "all",
    });
    for (const match of matches) {
      if (typeof match.value !== "string") continue;
      const translated = dict[match.value];
      if (translated !== undefined) {
        match.parent[match.parentProperty] = translated;
      }
    }
  }
  return envelope;
}
