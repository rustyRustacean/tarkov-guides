/**
 * tarkov.dev's REST-ish JSON API, which replaced the GraphQL endpoint after
 * it started returning `503 GraphQL server unavailable`. Endpoint list
 * confirmed via `https://json.tarkov.dev/endpoints`; translation mechanism
 * confirmed directly with a tarkov.dev staff member and cross-checked
 * against their own reference client, `the-hideout/tarkov-dev`'s
 * `src/modules/api-request.mjs`.
 */
export const JSON_API_BASE_URL = "https://json.tarkov.dev";

/** The only UI language this app supports today. */
export const JSON_API_LANG = "en";

/**
 * Resources that ship a `translations` JSONPath list and have a matching
 * `{resource}_{lang}` translation-dictionary endpoint, confirmed via
 * `/endpoints`'s `translations: true` flag per resource.
 */
export const TRANSLATABLE_JSON_API_RESOURCES = [
  "items",
  "tasks",
  "traders",
  "hideout",
  "maps",
] as const;

/** Resources with no translatable fields (`translations: false` per `/endpoints`): bare id-only cross-references throughout, fetched without a `_{lang}` companion request. */
export const UNTRANSLATED_JSON_API_RESOURCES = ["barters", "crafts"] as const;
