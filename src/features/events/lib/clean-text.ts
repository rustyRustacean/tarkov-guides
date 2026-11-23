/**
 * Control characters, plus zero-width and bidi formatting characters, which
 * can hide text or flip its direction on a leaderboard or a preset name.
 * Written as escapes on purpose: the characters themselves are invisible.
 */
const UNSAFE_CHARS = new RegExp(
  "[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u202a-\\u202e\\u2060-\\u2064\\ufeff]",
  "g",
);

/** Trims, strips control and invisible formatting characters, and caps the length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFC").replace(UNSAFE_CHARS, "").trim().slice(0, max);
}
