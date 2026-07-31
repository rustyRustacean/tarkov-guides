import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

export interface ParsedChainPart {
  baseName: string;
  partNumber: number;
}

const CHAIN_PART_NAME_PATTERN = /^(.*) - Part (\d+)$/;

/**
 * Parses tarkov.dev's real `"<Base Name> - Part <N>"` task-naming convention
 * (e.g. `"Signal - Part 3"`, `"Postman Pat - Part 1"`) - purely a naming
 * convention, there is no structural field for this anywhere in `RawTask`/
 * `NormalizedTask`. Returns `null` for any task name that doesn't match, or
 * whose part number isn't a positive integer.
 */
export function parseChainPartName(name: string): ParsedChainPart | null {
  const match = CHAIN_PART_NAME_PATTERN.exec(name.trim());
  if (!match) return null;
  const baseName = (match[1] ?? "").trim();
  const partNumber = Number(match[2]);
  if (baseName.length === 0 || !Number.isInteger(partNumber) || partNumber <= 0) return null;
  return { baseName, partNumber };
}

export interface QuestChain {
  /** Stable id derived from the chain's first part's real task id (never a slugified name, so it can't collide). */
  chainId: string;
  baseName: string;
  /** Validated run, ordered part 1..N. */
  taskIds: readonly string[];
  /**
   * The real "Part N" number parsed from each task's own name (via
   * {@link parseChainPartName}), parallel to {@link taskIds} (same length,
   * same order) - NOT necessarily `1..taskIds.length`. A run's lowest part
   * can be excluded from detection (filtered out of the input task set, or
   * dropped for name-number ambiguity), so a validly-detected chain can
   * legitimately start at real Part 2 or later. Consumers labeling a
   * specific part should read this, not recompute a label from array
   * position - the task's own name (e.g. "Signal - Part 3") would otherwise
   * disagree with a positionally-recomputed "Part 1".
   */
  partNumbers: readonly number[];
  /** Distinct `trader.name` values in part order (first-occurrence dedup). */
  traderNames: readonly string[];
  /** `true` when this chain's parts belong to more than one trader (e.g. "Colleagues" - Part 1 Peacekeeper, Part 2 Prapor). */
  crossesTraders: boolean;
}

interface ChainCandidate {
  task: NormalizedTask;
  partNumber: number;
}

/**
 * Base names whose real in-game unlock structure doesn't fit the generic
 * "each part's sole prerequisite is exactly part N-1" rule
 * {@link detectQuestChains} otherwise relies on to validate a chain -
 * user-confirmed that Gunsmith's first 3 parts have an uncommon unlock
 * structure that breaks that per-part-prerequisite assumption (unlike every
 * other real chain, which the generic algorithm already detects correctly).
 * The generic algorithm would only ever merge a truncated prefix (or nothing
 * at all) for a name in this set, so it's bypassed entirely: every
 * unambiguous same-base-name candidate is bundled into one chain, ordered by
 * its own parsed part number, with no prerequisite-linkage check at all.
 * Hardcoded as a narrow, explicit exception - not worth generalizing the
 * detection algorithm for what is, across the whole quest database, a single
 * quirky chain.
 */
const HARDCODED_CHAIN_BASE_NAMES: ReadonlySet<string> = new Set(["Gunsmith"]);

/**
 * Builds a `QuestChain` from an already-ordered run of candidates (2+
 * required - a single matching task isn't a chain). Shared by
 * {@link detectQuestChains}'s normal prerequisite-validated run-building and
 * its {@link HARDCODED_CHAIN_BASE_NAMES} bypass, so both paths produce
 * identically-shaped chains.
 */
function buildChain(baseName: string, run: readonly ChainCandidate[]): QuestChain | null {
  if (run.length < 2) return null;
  const taskIds = run.map((candidate) => candidate.task.id);
  const partNumbers = run.map((candidate) => candidate.partNumber);
  const traderNames: string[] = [];
  for (const candidate of run) {
    if (!traderNames.includes(candidate.task.trader.name)) {
      traderNames.push(candidate.task.trader.name);
    }
  }
  const firstTaskId = taskIds[0];
  if (firstTaskId === undefined) return null;
  return {
    chainId: `chain:${firstTaskId}`,
    baseName,
    taskIds,
    partNumbers,
    traderNames,
    crossesTraders: traderNames.length > 1,
  };
}

/**
 * Detects real multi-part quest chains among `tasks` (intended to be called
 * on the already-filtered visible task set, so a partially-hidden chain just
 * yields a shorter - or no - detected chain for free).
 *
 * Detection is structural, not just name-based, because a name match alone
 * isn't proof of a real chain: two unrelated tasks can coincidentally share a
 * `"<Base> - Part N"`-shaped name, and some real chains cross traders (e.g.
 * "Colleagues"), so trader identity can't be used to validate either. A
 * name-matched task only joins a chain if its sole prerequisite among other
 * same-base-name candidates is literally part `N - 1`'s real task id - this
 * also means a chain broken mid-sequence truncates to the valid prefix
 * rather than silently merging unrelated tasks.
 */
export function detectQuestChains(tasks: readonly NormalizedTask[]): readonly QuestChain[] {
  const candidatesByBase = new Map<string, ChainCandidate[]>();
  for (const task of tasks) {
    const parsed = parseChainPartName(task.name);
    if (!parsed) continue;
    const bucket = candidatesByBase.get(parsed.baseName);
    if (bucket) bucket.push({ task, partNumber: parsed.partNumber });
    else candidatesByBase.set(parsed.baseName, [{ task, partNumber: parsed.partNumber }]);
  }

  const chains: QuestChain[] = [];

  for (const [baseName, candidates] of candidatesByBase) {
    const countByPart = new Map<number, number>();
    for (const candidate of candidates) {
      countByPart.set(candidate.partNumber, (countByPart.get(candidate.partNumber) ?? 0) + 1);
    }
    // Two tasks claiming the same part number is an unresolvable ambiguity -
    // never guess which one is "real", drop both from candidacy.
    const unambiguous = candidates.filter(
      (candidate) => countByPart.get(candidate.partNumber) === 1,
    );
    if (unambiguous.length < 2) continue;

    unambiguous.sort((a, b) => a.partNumber - b.partNumber);

    if (HARDCODED_CHAIN_BASE_NAMES.has(baseName)) {
      const chain = buildChain(baseName, unambiguous);
      if (chain) chains.push(chain);
      continue;
    }

    const candidateTaskIds = new Set(unambiguous.map((candidate) => candidate.task.id));
    const taskIdByPart = new Map(
      unambiguous.map((candidate) => [candidate.partNumber, candidate.task.id]),
    );

    let run: ChainCandidate[] = [];

    const flush = (): void => {
      const chain = buildChain(baseName, run);
      if (chain) chains.push(chain);
      run = [];
    };

    for (const candidate of unambiguous) {
      const sameChainPrereqs = candidate.task.taskRequirements
        .map((requirement) => requirement.taskId)
        .filter((id) => candidateTaskIds.has(id));

      const previous = run.at(-1);

      if (previous === undefined) {
        if (sameChainPrereqs.length === 0) run.push(candidate);
        continue;
      }

      const expectedPrevTaskId = taskIdByPart.get(candidate.partNumber - 1);
      const extendsRun =
        sameChainPrereqs.length === 1 &&
        sameChainPrereqs[0] === expectedPrevTaskId &&
        expectedPrevTaskId === previous.task.id;

      if (extendsRun) {
        run.push(candidate);
      } else {
        flush();
        if (sameChainPrereqs.length === 0) run.push(candidate);
      }
    }
    flush();
  }

  return chains;
}

/**
 * Aggregates a chain's member statuses into the same status-key vocabulary
 * `QuestTreeView`'s `nodeStatusKey` uses (`done`/`failed`/`inprog`/
 * `available`/`locked`) - for the collapsed chain node's coloring. Any
 * failed part fails the whole chain; every part done means done; otherwise
 * the first not-done part's own availability (in-progress, available, or
 * locked) represents the chain's current state. No member present in
 * `availability` at all (e.g. an empty map) falls back to `locked`, same as
 * `nodeStatusKey`'s convention for a standalone task with no data - without
 * this guard, `Array.prototype.every` on the resulting empty array is
 * vacuously `true`, which would otherwise report a data-less chain as
 * `done`. Takes just the `taskIds` it actually reads (via `Pick`) - see
 * {@link getChainActiveTaskId}'s doc comment for why.
 */
export function aggregateChainStatus(
  chain: Pick<QuestChain, "taskIds">,
  availability: ReadonlyMap<string, QuestAvailability>,
): string {
  const memberAvailability = chain.taskIds
    .map((taskId) => availability.get(taskId))
    .filter((entry) => entry !== undefined);

  if (memberAvailability.length === 0) return "locked";
  if (memberAvailability.some((entry) => entry.status === "failed")) return "failed";
  if (memberAvailability.every((entry) => entry.status === "done")) return "done";

  const activePart = memberAvailability.find((entry) => entry.status !== "done");
  if (!activePart) return "locked";
  if (activePart.status === "inprog") return "inprog";
  return activePart.isAvailable ? "available" : "locked";
}

/**
 * The chain's current "active" part - the first not-yet-done part, or the
 * last part if every part is done. Used to pick which part a chain's
 * double-click detail-dialog shortcut targets. Takes just the `taskIds` it
 * actually reads (via `Pick`), not the full `QuestChain` - lets
 * `QuestTreeView` call this with its own render-layer `QuestTreeChainNode`
 * (which has its own, differently-shaped `parts[]`) without needing an
 * unused `partNumbers` field bolted onto that type just to satisfy this
 * signature.
 */
export function getChainActiveTaskId(
  chain: Pick<QuestChain, "taskIds">,
  availability: ReadonlyMap<string, QuestAvailability>,
): string {
  for (const taskId of chain.taskIds) {
    if (availability.get(taskId)?.status !== "done") return taskId;
  }
  return chain.taskIds.at(-1) ?? chain.taskIds[0] ?? "";
}
