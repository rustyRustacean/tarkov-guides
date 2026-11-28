import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from "obscenity";

import { stripInvisible } from "./clean-text";

import type { Preset } from "../types";

/**
 * The profanity and slur filter for anything published to the public preset
 * library. The server runs it on every publish and update (authoritative);
 * the publish dialog runs the same function first, so the owner sees the
 * problem before sending anything.
 *
 * Matching is `obscenity`'s English dataset with its recommended
 * transformers (leetspeak, look-alike letters, repeated letters, case).
 * Before matching, the text is folded further: compatibility forms
 * (fullwidth letters) are decomposed and combining marks (strikethrough,
 * accents stacked on letters) dropped, for any character, not only the ones
 * the library's look-alike table knows; invisible characters go the same way
 * as in `cleanText`; and runs of single letters ("f u c k", "f.u.c.k") are
 * joined. Only runs of three or more single characters are joined, so
 * ordinary words next to each other are never merged into a false match.
 * Words masked with one or two asterisks ("sh*t") are checked with every
 * letter in place of each asterisk; masks of three or more are left to
 * reports.
 */

/** Tarkov words the English dataset would otherwise flag. */
const ALLOWED_TERMS = [
  // "Analgin painkillers", a stock medical item.
  "analgin",
];

const COMBINING_MARKS = /\p{M}/gu;
/** Three or more single letters or digits, each set apart by separators. */
const SPACED_RUN =
  /(?<![\p{L}\p{N}])[\p{L}\p{N}](?:[^\p{L}\p{N}]+[\p{L}\p{N}](?![\p{L}\p{N}])){2,}/gu;
const SEPARATORS = /[^\p{L}\p{N}]/gu;
/** A word with letters masked by asterisks ("sh*t"). */
const MASKED_WORD = /[\p{L}\p{N}]*\*[\p{L}\p{N}*]*/gu;
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const MAX_MASKS_PER_WORD = 2;
/**
 * The most masked words unmasked per check, across every field of a preset.
 * This is the cost bound: each word is one match over up to 676 spellings
 * (about 0.7 ms). Text with more masked words than this is blocked rather
 * than passed, so decoys can't use up the budget ahead of a real slur.
 */
const MAX_MASKED_WORDS = 32;

const dataset = englishDataset.build();
const matcher = new RegExpMatcher({
  ...dataset,
  ...englishRecommendedTransformers,
  whitelistedTerms: [...(dataset.whitelistedTerms ?? []), ...ALLOWED_TERMS],
});

function fold(text: string): string {
  return stripInvisible(text.normalize("NFKD").replace(COMBINING_MARKS, ""));
}

/** Every spelling of `word` with each `*` replaced by a letter. */
function unmaskings(word: string): string[] {
  const at = word.indexOf("*");
  if (at === -1) return [word];
  return LETTERS.flatMap((letter) =>
    unmaskings(`${word.slice(0, at)}${letter}${word.slice(at + 1)}`),
  );
}

/** How many masked words a check may still unmask. Shared across a preset's fields. */
interface MaskBudget {
  words: number;
}

function hasBlockedMaskedWord(text: string, budget: MaskBudget): boolean {
  const words = new Set(
    (text.match(MASKED_WORD) ?? []).filter((word) => {
      const stars = word.length - word.replaceAll("*", "").length;
      return stars <= MAX_MASKS_PER_WORD && word.length - stars >= 2;
    }),
  );
  for (const word of words) {
    // Fail closed: past the budget, unchecked masked words count as blocked.
    if (budget.words <= 0) return true;
    budget.words -= 1;
    // One match over every spelling, space-separated, instead of one per spelling.
    if (matcher.hasMatch(unmaskings(word).join(" "))) return true;
  }
  return false;
}

function isBlocked(text: string, budget: MaskBudget): boolean {
  const folded = fold(text);
  if (!folded.trim()) return false;
  if (matcher.hasMatch(folded)) return true;
  const joined = folded.replace(SPACED_RUN, (run) => run.replace(SEPARATORS, ""));
  if (joined !== folded && matcher.hasMatch(joined)) return true;
  return hasBlockedMaskedWord(folded, budget);
}

/**
 * True when `text` contains profanity or a slur, including disguised
 * spellings. Words split into chunks of two or more letters ("sh it") are
 * deliberately not joined: short words sit next to each other all the time
 * ("go at it"), so joining them would block honest text. Reports catch what
 * the filter misses.
 */
export function containsBlockedText(text: string): boolean {
  return isBlocked(text, { words: MAX_MASKED_WORDS });
}

/** Where a preset's blocked text is. */
export type BlockedPresetField =
  { field: "name" } | { field: "description" } | { field: "note"; ruleId: string };

/** The first field of `preset` that fails the filter, or `null` when it's all clean. */
export function findBlockedPresetText(preset: Preset): BlockedPresetField | null {
  const budget: MaskBudget = { words: MAX_MASKED_WORDS };
  if (isBlocked(preset.name, budget)) return { field: "name" };
  if (isBlocked(preset.description, budget)) return { field: "description" };
  for (const rule of preset.rules) {
    if (rule.note && isBlocked(rule.note, budget)) return { field: "note", ruleId: rule.id };
  }
  return null;
}

const FIELD_LABELS: Readonly<Record<BlockedPresetField["field"], string>> = {
  name: "The preset's name",
  description: "The description",
  note: "A rule's note",
};

/** A sentence telling the owner what to change. */
export function blockedFieldMessage(issue: BlockedPresetField): string {
  return `${FIELD_LABELS[issue.field]} has language the public library doesn't allow. Change it and try again.`;
}
