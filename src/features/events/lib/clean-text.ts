/** Control characters (Unicode category Cc). */
const CONTROL = /\p{Cc}/gu;
const WHITESPACE = /\s/u;
/**
 * Format characters (category Cf): zero-width, bidi overrides and isolates,
 * soft hyphens, the BOM. They can hide text, split a word invisibly or flip
 * its direction on a leaderboard or a preset name.
 */
const FORMAT = /\p{Cf}/gu;

/**
 * Removes invisible characters: control characters that are whitespace
 * (line breaks, tabs) become a space so the words on either side stay
 * apart; every other control or format character is dropped. Shared by
 * {@link cleanText} and the profanity filter, so both see the same text.
 */
export function stripInvisible(text: string): string {
  return text.replace(CONTROL, (char) => (WHITESPACE.test(char) ? " " : "")).replace(FORMAT, "");
}

/** Trims, strips control and invisible formatting characters, and caps the length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return stripInvisible(value.normalize("NFC")).trim().slice(0, max);
}
