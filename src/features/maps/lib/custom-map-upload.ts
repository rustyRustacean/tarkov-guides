/**
 * Pure helpers for the custom-map-upload flow - id generation, file
 * validation, and the file-read step. Kept separate from the orchestrating
 * hook (`hooks/use-custom-map-upload.ts`) so each piece is independently
 * testable, matching this project's established "pure lib + thin wiring
 * hook" split.
 */

/** `custom-<timestamp base36>-<random base36>` - ported verbatim from `old/TarkovTrackerWB-main/src/lib/mapsConfig.js`'s custom-map id generator. */
export function generateCustomMapId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `custom-${timestamp}-${random}`;
}

/** The minimal file shape `isImageFile` needs to classify a file. */
export interface ImageFileCandidate {
  type: string;
}

/** True for a file whose MIME type is `image/*` - ported from legacy's upload-time check. */
export function isImageFile(file: ImageFileCandidate): boolean {
  return file.type.startsWith("image/");
}

/**
 * A hard cap on the source file size, in bytes - replaces legacy's soft
 * "over 25MB? confirm() to continue anyway" warning with a flat reject (this
 * project avoids native `confirm()`/`prompt()`/`alert()` everywhere else -
 * see the Phase 5 step 12 plan's decision record). 15MB of source image
 * inflates to ~20MB once base64-encoded for storage.
 */
export const MAX_CUSTOM_MAP_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Reads a `File` as a base64 data URL - the same `FileReader`-wrapped-in-a-
 * -Promise shape `progress-tracker/persistence/manual-json-adapter.ts`'s
 * `readJsonFile` already establishes in this codebase, for `readAsDataURL`
 * instead of `readAsText`. Rejects (rather than resolving a sentinel) on a
 * genuine `FileReader` failure, since the caller has already validated the
 * file beforehand - an error here is unexpected and should surface as one.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("FileReader did not return a data URL"));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Could not read file"));
    });
    reader.readAsDataURL(file);
  });
}
