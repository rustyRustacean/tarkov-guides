import { applyTranslations } from "./apply-translations";
import { JSON_API_BASE_URL, JSON_API_LANG } from "./json-api-constants";

import type { JsonApiEnvelope, JsonApiTranslationDict } from "./json-api-types";

export type JsonApiGameMode = "regular" | "pve";

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(
      `tarkov.dev JSON API responded with HTTP ${String(response.status)} for ${url}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Fetches one translatable JSON API resource (items/tasks/traders/hideout/maps)
 * and resolves its placeholder-key text fields (`name`/`shortName`/
 * `description`/...) into real strings, per the mechanism confirmed with a
 * tarkov.dev staff member: fetch `{resource}_{lang}` for the translation
 * dictionary, then apply it via {@link applyTranslations} using the
 * envelope's own `translations` JSONPath list.
 *
 * The base payload and its dictionary are fetched in parallel. If the
 * dictionary fetch fails but the base payload succeeds, this returns the
 * untranslated (placeholder-key) payload rather than failing the whole
 * resource - worse-than-ideal names beat no data at all, matching this
 * app's existing "partial outage, keep going" tolerance
 * (`mergeWithPreviousGameData`).
 */
export async function fetchTranslatedJsonResource<T>(
  resource: string,
  gameMode: JsonApiGameMode = "regular",
  signal?: AbortSignal,
): Promise<T> {
  const baseUrl = `${JSON_API_BASE_URL}/${gameMode}/${resource}`;
  const dictUrl = `${baseUrl}_${JSON_API_LANG}`;

  const [envelope, dict] = await Promise.all([
    fetchJson<JsonApiEnvelope<T>>(baseUrl, signal),
    fetchJson<JsonApiTranslationDict>(dictUrl, signal).catch(() => null),
  ]);

  if (dict) {
    applyTranslations(envelope, envelope.translations, dict.data);
  }

  return envelope.data;
}

/** Fetches a non-translatable JSON API resource (barters/crafts, or a translatable resource fetched only for its non-text fields, e.g. PvE item prices) - no `_{lang}` companion request. */
export async function fetchJsonApiResource<T>(
  resource: string,
  gameMode: JsonApiGameMode = "regular",
  signal?: AbortSignal,
): Promise<T> {
  const envelope = await fetchJson<{ data: T }>(
    `${JSON_API_BASE_URL}/${gameMode}/${resource}`,
    signal,
  );
  return envelope.data;
}
