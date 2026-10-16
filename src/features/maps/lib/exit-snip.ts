import type { RawMap, RawMapExtract, RawMapTransit } from "@/shared/lib/tarkov-api/types";

/**
 * Exit list snip -> extracts on the map.
 *
 * The companion OCRs a Win+Shift+S snip of the in-raid exit list (O) and
 * returns one row per EXFIL/TRANSIT line. This module turns those rows into
 * map pins. Two rules shape everything here:
 *
 * 1. THE MAP IS NEVER TAKEN FROM THE SNIP. The rows are paired with the map
 *    the game log says the player is in. The snip is only used afterwards to
 *    CHECK that pairing: if its names don't fit that map, nothing is applied.
 * 2. A READ IS EITHER RIGHT OR FLAGGED. A row is matched to a known extract or
 *    it is reported as unmatched; there is no "closest guess" that gets drawn.
 */

/** One row as returned by the companion's `GET /exits`. */
export interface ExitSnipRow {
  kind: "exfil" | "transit";
  index: number | null;
  name: string;
  /** Whether the timer column held any text. On an EXFIL row that is the game's `??:??:??` (availability unknown); a transit always has one. */
  hasTimer: boolean;
}

export type ExitSide = "pmc" | "scav";

export interface AppliedExit {
  kind: "exfil" | "transit";
  /** The dataset's own id for this exit. */
  id: string;
  /** Canonical in-game name from the map data (not the OCR text). */
  name: string;
  /** Game-space position, or `null` when the data has none (nothing can be drawn). */
  position: { x: number; y: number; z: number } | null;
  /** The exit is listed but its availability is unknown (`??:??:??`). */
  unknown: boolean;
  /** How the row was matched: `exact`, or `inferred` (one near candidate left after elimination). */
  match: "exact" | "inferred";
}

export interface UnmatchedExit {
  kind: "exfil" | "transit";
  name: string;
  reason: "no-candidate" | "ambiguous";
}

export type ExitSnipOutcome =
  | {
      status: "applied";
      /** The `nameId` the exits belong to (the map the game says you are in). */
      nameId: string;
      side: ExitSide | "unknown";
      exits: readonly AppliedExit[];
      unmatched: readonly UnmatchedExit[];
    }
  | {
      status: "refused";
      reason: "no-map" | "not-exit-list" | "map-mismatch" | "too-few-matches";
      /** Plain-language explanation, safe to show the player. */
      message: string;
    };

// ─── Text normalization ──────────────────────────────────────────────────

/**
 * Comparison key: lowercase, no diacritics, the game's slashed zero (read by
 * OCR as `Ø`) folded to `0`, everything that isn't a letter or digit dropped.
 */
export function normalizeExitName(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[Øø]/g, "0")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Levenshtein distance, iterative two-row form. Names are short, so this is cheap. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

/** Minimum similarity for a fuzzy (non-exact) match. */
const FUZZY_MIN = 0.86;
/** The best fuzzy candidate must beat the runner-up by at least this much. */
const FUZZY_MARGIN = 0.08;

// ─── Matching ────────────────────────────────────────────────────────────

interface Candidate {
  kind: "exfil" | "transit";
  id: string;
  name: string;
  key: string;
  position: { x: number; y: number; z: number } | null;
}

interface RowMatch {
  row: ExitSnipRow;
  candidate: Candidate | null;
  match: "exact" | "inferred" | null;
  ambiguous: boolean;
}

/**
 * Assign each row to at most one candidate, in three passes of decreasing
 * confidence. A candidate is claimed once, so two rows can never land on the
 * same exit, and each later pass only sees what the earlier ones left:
 *
 * - exact: normalized text equal.
 * - fuzzy: similar enough, and clearly better than the runner-up.
 * - dropped-zero: the row equals a candidate minus ONE trailing `0` (OCR
 *   drops the game's slashed zero: "Gate 0" arrives as "Gate"), and exactly
 *   one unclaimed candidate fits. Only a zero, never another digit: a real
 *   "Gate 2" is read as "Gate 2", and treating any digit as droppable would
 *   make "Gate" ambiguous between them.
 */
function assign(rows: readonly ExitSnipRow[], candidates: readonly Candidate[]): RowMatch[] {
  const results: RowMatch[] = rows.map((row) => ({
    row,
    candidate: null,
    match: null,
    ambiguous: false,
  }));
  const claimed = new Set<string>();
  const keyOf = (row: ExitSnipRow) => normalizeExitName(row.name);

  // Pass 1: exact. Candidates sharing one name (the same label on two sides)
  // are an ambiguity, not a free choice.
  results.forEach((result) => {
    const key = keyOf(result.row);
    if (key.length === 0) return;
    const hits = candidates.filter((c) => c.key === key && !claimed.has(c.id));
    if (hits.length === 1 && hits[0]) {
      result.candidate = hits[0];
      result.match = "exact";
      claimed.add(hits[0].id);
    } else if (hits.length > 1) {
      result.ambiguous = true;
    }
  });

  // Pass 2: fuzzy, unique and clearly ahead.
  results.forEach((result) => {
    if (result.candidate || result.ambiguous) return;
    const key = keyOf(result.row);
    if (key.length < 4) return;
    const scored = candidates
      .filter((c) => !claimed.has(c.id))
      .map((c) => ({ c, score: similarity(key, c.key) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const runnerUp = scored[1];
    if (!best || best.score < FUZZY_MIN) return;
    if (runnerUp && best.score - runnerUp.score < FUZZY_MARGIN) return;
    result.candidate = best.c;
    result.match = "inferred";
    claimed.add(best.c.id);
  });

  // Pass 3: dropped trailing zero, exactly one unclaimed candidate fits.
  results.forEach((result) => {
    if (result.candidate || result.ambiguous) return;
    const key = keyOf(result.row);
    if (key.length < 3) return;
    const fits = candidates.filter((c) => !claimed.has(c.id) && c.key === `${key}0`);
    if (fits.length === 1 && fits[0]) {
      result.candidate = fits[0];
      result.match = "inferred";
      claimed.add(fits[0].id);
    } else if (fits.length > 1) {
      result.ambiguous = true;
    }
  });

  return results;
}

function extractCandidates(
  extracts: readonly RawMapExtract[],
  side: ExitSide,
): readonly Candidate[] {
  return extracts
    .filter((extract) => extract.faction === side || extract.faction === "shared")
    .map((extract) => ({
      kind: "exfil" as const,
      id: extract.id,
      name: extract.name,
      key: normalizeExitName(extract.name),
      position: extract.position,
    }));
}

function transitCandidates(transits: readonly RawMapTransit[]): readonly Candidate[] {
  return transits.map((transit) => ({
    kind: "transit" as const,
    id: transit.id,
    name: transit.name,
    key: normalizeExitName(transit.name),
    position: transit.position,
  }));
}

function countMatched(matches: readonly RowMatch[]): number {
  return matches.filter((match) => match.candidate !== null).length;
}

/** Share of a snip's EXFIL rows that must match the map for it to be trusted. */
const MIN_EXFIL_MATCH_SHARE = 0.6;

function mapLabel(map: RawMap | undefined): string {
  return map?.name ?? "this map";
}

/**
 * The map whose extract list best explains these rows, for the "this looks
 * like X" half of a refusal. Purely descriptive: it never changes which map
 * is applied.
 */
function bestFittingMap(
  exfilRows: readonly ExitSnipRow[],
  maps: readonly RawMap[],
): RawMap | undefined {
  let best: { map: RawMap; matched: number } | undefined;
  for (const map of maps) {
    const extracts = map.extracts ?? [];
    if (extracts.length === 0) continue;
    for (const side of ["pmc", "scav"] as const) {
      const matched = countMatched(assign(exfilRows, extractCandidates(extracts, side)));
      if (matched > 0 && (best === undefined || matched > best.matched)) best = { map, matched };
    }
  }
  return best?.map;
}

/**
 * Turn a snip's rows into exits for the map the player is on.
 *
 * `nameId` is the game's own location id for the CURRENT raid (the
 * companion's `raidLocation`); it selects the map, the snip never does.
 */
export function matchExitSnip(
  rows: readonly ExitSnipRow[],
  nameId: string | null,
  maps: readonly RawMap[],
): ExitSnipOutcome {
  const exfilRows = rows.filter((row) => row.kind === "exfil");
  const transitRows = rows.filter((row) => row.kind === "transit");
  if (exfilRows.length + transitRows.length === 0) {
    return {
      status: "refused",
      reason: "not-exit-list",
      message: "That doesn't look like the exit list.",
    };
  }

  const key = nameId?.toLowerCase() ?? "";
  const map = key.length === 0 ? undefined : maps.find((m) => m.nameId?.toLowerCase() === key);
  if (!map || (map.extracts ?? []).length === 0) {
    return {
      status: "refused",
      reason: "no-map",
      message: "Couldn't tell which map you're on, so the exits weren't applied.",
    };
  }
  const extracts = map.extracts ?? [];

  // Both sides are tried against the WHOLE list and the better explanation
  // wins, because a name can exist for both sides at different places
  // (Factory's "Gate 3", Interchange's "Railway Exfil").
  const pmc = assign(exfilRows, extractCandidates(extracts, "pmc"));
  const scav = assign(exfilRows, extractCandidates(extracts, "scav"));
  const exactCount = (matches: readonly RowMatch[]) =>
    matches.filter((m) => m.match === "exact").length;
  let exfilMatches: RowMatch[];
  let side: ExitSide | "unknown";
  if (exfilRows.length === 0) {
    exfilMatches = [];
    side = "unknown";
  } else if (countMatched(pmc) !== countMatched(scav)) {
    const pmcWins = countMatched(pmc) > countMatched(scav);
    exfilMatches = pmcWins ? pmc : scav;
    side = pmcWins ? "pmc" : "scav";
  } else if (exactCount(pmc) !== exactCount(scav)) {
    const pmcWins = exactCount(pmc) > exactCount(scav);
    exfilMatches = pmcWins ? pmc : scav;
    side = pmcWins ? "pmc" : "scav";
  } else {
    // Both sides explain the list equally well. Names that exist for only one
    // side still resolve; a name present for both sides at different spots
    // was already marked ambiguous by the exact pass and stays unmatched.
    exfilMatches = pmc;
    side = "unknown";
  }

  if (exfilRows.length > 0) {
    const matched = countMatched(exfilMatches);
    if (matched === 0) {
      const looksLike = bestFittingMap(exfilRows, maps);
      const detail =
        looksLike !== undefined && looksLike.nameId?.toLowerCase() !== key
          ? ` It looks like ${mapLabel(looksLike)}, but the game says you're on ${mapLabel(map)}.`
          : "";
      return {
        status: "refused",
        reason: "map-mismatch",
        message: `These exits don't match ${mapLabel(map)}.${detail} Nothing was changed.`,
      };
    }
    if (matched < Math.ceil(exfilRows.length * MIN_EXFIL_MATCH_SHARE)) {
      return {
        status: "refused",
        reason: "too-few-matches",
        message: `Only ${String(matched)} of ${String(exfilRows.length)} exits matched ${mapLabel(map)}, so nothing was applied. Try the snip again.`,
      };
    }
  }

  const transitMatches = assign(transitRows, transitCandidates(map.transits ?? []));

  const exits: AppliedExit[] = [];
  const unmatched: UnmatchedExit[] = [];
  for (const match of [...exfilMatches, ...transitMatches]) {
    if (match.candidate && match.match) {
      exits.push({
        kind: match.candidate.kind,
        id: match.candidate.id,
        name: match.candidate.name,
        position: match.candidate.position,
        // Only an EXFIL row can be "unknown": a transit always shows a timer.
        unknown: match.candidate.kind === "exfil" && match.row.hasTimer,
        match: match.match,
      });
    } else {
      unmatched.push({
        kind: match.row.kind,
        name: match.row.name.length > 0 ? match.row.name : "(unreadable)",
        reason: match.ambiguous ? "ambiguous" : "no-candidate",
      });
    }
  }

  return {
    status: "applied",
    nameId: map.nameId ?? key,
    side,
    exits,
    unmatched,
  };
}

/** One-line summary for the toast shown after a snip is applied. */
export function describeOutcome(outcome: Extract<ExitSnipOutcome, { status: "applied" }>): string {
  const exfils = outcome.exits.filter((exit) => exit.kind === "exfil");
  const unknown = exfils.filter((exit) => exit.unknown).length;
  const transits = outcome.exits.filter((exit) => exit.kind === "transit").length;
  const parts = [
    `${String(exfils.length)} extract${exfils.length === 1 ? "" : "s"}${
      unknown > 0 ? ` (${String(unknown)} unknown)` : ""
    }`,
  ];
  if (transits > 0) parts.push(`${String(transits)} transit${transits === 1 ? "" : "s"}`);
  let text = `Exits on the map: ${parts.join(", ")}.`;
  if (outcome.unmatched.length > 0) {
    text += ` Not recognized: ${outcome.unmatched.map((u) => u.name).join(", ")}.`;
  }
  return text;
}
