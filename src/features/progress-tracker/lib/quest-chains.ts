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
    const candidateTaskIds = new Set(unambiguous.map((candidate) => candidate.task.id));
    const taskIdByPart = new Map(
      unambiguous.map((candidate) => [candidate.partNumber, candidate.task.id]),
    );

    let run: ChainCandidate[] = [];

    const flush = (): void => {
      if (run.length >= 2) {
        const taskIds = run.map((candidate) => candidate.task.id);
        const traderNames: string[] = [];
        for (const candidate of run) {
          if (!traderNames.includes(candidate.task.trader.name)) {
            traderNames.push(candidate.task.trader.name);
          }
        }
        const firstTaskId = taskIds[0];
        if (firstTaskId !== undefined) {
          chains.push({
            chainId: `chain:${firstTaskId}`,
            baseName,
            taskIds,
            traderNames,
            crossesTraders: traderNames.length > 1,
          });
        }
      }
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
 * locked) represents the chain's current state.
 */
export function aggregateChainStatus(
  chain: QuestChain,
  availability: ReadonlyMap<string, QuestAvailability>,
): string {
  const memberAvailability = chain.taskIds
    .map((taskId) => availability.get(taskId))
    .filter((entry) => entry !== undefined);

  if (memberAvailability.some((entry) => entry.status === "failed")) return "failed";
  if (memberAvailability.every((entry) => entry.status === "done")) return "done";

  const activePart = memberAvailability.find((entry) => entry.status !== "done");
  if (!activePart) return "locked";
  if (activePart.status === "inprog") return "inprog";
  return activePart.isAvailable ? "available" : "locked";
}

/** The chain's current "active" part - the first not-yet-done part, or the last part if every part is done. Used to pick which part a chain's double-click detail-dialog shortcut targets. */
export function getChainActiveTaskId(
  chain: QuestChain,
  availability: ReadonlyMap<string, QuestAvailability>,
): string {
  for (const taskId of chain.taskIds) {
    if (availability.get(taskId)?.status !== "done") return taskId;
  }
  return chain.taskIds.at(-1) ?? chain.taskIds[0] ?? "";
}
