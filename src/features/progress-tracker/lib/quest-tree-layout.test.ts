import { describe, expect, it } from "vitest";

import {
  buildEdgeEndpointIndex,
  buildLaneTraderIndex,
  computeChainStackOffsets,
  computeQuestTreeLayout,
} from "./quest-tree-layout";

import type { QuestChain } from "./quest-chains";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(
  id: string,
  prereqIds: readonly string[] = [],
  traderName = "Trader",
): NormalizedTask {
  return {
    id,
    name: id,
    kappaRequired: false,
    minPlayerLevel: 1,
    experience: 0,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestigeLevel: null,
    trader: { id: traderName, name: traderName, imageLink: null },
    maps: [],
    taskRequirements: prereqIds.map((taskId) => ({ taskId, status: ["complete"] })),
    traderRequirements: [],
    objectives: [],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    itemRequirements: [],
  };
}

function makeChain(
  taskIds: readonly string[],
  traderNames: readonly string[],
  // Defaults to positional 1..N - every pre-existing fixture relies on this
  // (its task ids already happen to align 1:1 with part position), so only
  // a test specifically about a chain starting below Part 1 needs to pass
  // its own value.
  partNumbers: readonly number[] = taskIds.map((_, index) => index + 1),
): QuestChain {
  const firstTaskId = taskIds[0];
  if (firstTaskId === undefined) throw new Error("makeChain requires at least one task id");
  return {
    chainId: `chain:${firstTaskId}`,
    baseName: "Chain",
    taskIds,
    partNumbers,
    traderNames,
    crossesTraders: traderNames.length > 1,
  };
}

type Layout = ReturnType<typeof computeQuestTreeLayout>;

function findNode(layout: Layout, idOrChainId: string) {
  return layout.nodes.find((node) =>
    node.kind === "task" ? node.taskId === idOrChainId : node.chainId === idOrChainId,
  );
}

function layerOf(layout: Layout, taskId: string): number | undefined {
  return findNode(layout, taskId)?.layer;
}

describe("computeQuestTreeLayout", () => {
  it("assigns layer 0 to a task with no prerequisites", () => {
    const layout = computeQuestTreeLayout([makeTask("a")]);
    expect(layerOf(layout, "a")).toBe(0);
  });

  it("assigns a single-prerequisite task layer = prereq layer + 1", () => {
    const a = makeTask("a");
    const b = makeTask("b", ["a"]);
    const layout = computeQuestTreeLayout([a, b]);
    expect(layerOf(layout, "a")).toBe(0);
    expect(layerOf(layout, "b")).toBe(1);
  });

  it("a 2-prerequisite node's layer is max(prereq layers) + 1 - the confirmed legacy BFS bug fix", () => {
    // a (layer 0) -> b (layer 1) -> c depends on BOTH a and b.
    // Legacy's single-visited-Set BFS would give c layer 1 if it reached c
    // via `a` first (since `a` marks `c` visited at level 0+1), silently
    // ignoring the deeper `b` requirement. The correct answer is layer 2.
    const a = makeTask("a");
    const b = makeTask("b", ["a"]);
    const c = makeTask("c", ["a", "b"]);
    const layout = computeQuestTreeLayout([a, b, c]);
    expect(layerOf(layout, "a")).toBe(0);
    expect(layerOf(layout, "b")).toBe(1);
    expect(layerOf(layout, "c")).toBe(2);
  });

  it("skips a taskRequirements entry pointing at an id outside the given task list (fail-open)", () => {
    const a = makeTask("a", ["missing-other-faction-task"]);
    const layout = computeQuestTreeLayout([a]);
    expect(layerOf(layout, "a")).toBe(0);
  });

  it("does not infinite-loop on a cycle and still assigns every task a layer", () => {
    const a = makeTask("a", ["b"]);
    const b = makeTask("b", ["a"]);
    const layout = computeQuestTreeLayout([a, b]);
    expect(layerOf(layout, "a")).toBeDefined();
    expect(layerOf(layout, "b")).toBeDefined();
  });

  it("builds one edge per in-scope prerequisite, directed prerequisite -> dependent", () => {
    const a = makeTask("a");
    const b = makeTask("b", ["a"]);
    const layout = computeQuestTreeLayout([a, b]);
    expect(layout.edges).toEqual([{ fromTaskId: "a", toTaskId: "b" }]);
  });

  it("centers each layer's nodes and reports a width covering the widest layer (single-lane case, since every task shares one trader)", () => {
    const a1 = makeTask("a1");
    const a2 = makeTask("a2");
    const a3 = makeTask("a3");
    const b1 = makeTask("b1", ["a1"]);
    const layout = computeQuestTreeLayout([a1, a2, a3, b1], [], new Set(), {
      nodeWidth: 100,
      columnGap: 20,
    });
    // Layer 0 has 3 nodes spanning the full width; layer 1 has 1 node, so it
    // should be horizontally centered relative to layer 0's span.
    const layer0Xs = layout.nodes.filter((n) => n.layer === 0).map((n) => n.x);
    const layer1Xs = layout.nodes.filter((n) => n.layer === 1).map((n) => n.x);
    expect(Math.min(...layer0Xs)).toBe(0);
    expect(layout.width).toBe(3 * 100 + 2 * 20);
    expect(layer1Xs[0]).toBeCloseTo((layout.width - 100) / 2);
  });

  it("returns an empty layout for an empty task list", () => {
    const layout = computeQuestTreeLayout([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.lanes).toEqual([]);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });

  describe("trader swim lanes", () => {
    it("creates one lane per distinct trader, ordered via the canonical in-game roster regardless of input order", () => {
      const skierTask = makeTask("skier-task", [], "Skier");
      const praporTask = makeTask("prapor-task", [], "Prapor");
      // Input order is Skier-then-Prapor, but the canonical roster puts
      // Prapor before Skier.
      const layout = computeQuestTreeLayout([skierTask, praporTask]);
      expect(layout.lanes.map((lane) => lane.traderName)).toEqual(["Prapor", "Skier"]);
    });

    it("gives no lane to a trader with zero currently-visible tasks", () => {
      const layout = computeQuestTreeLayout([makeTask("a", [], "Prapor")]);
      expect(layout.lanes).toHaveLength(1);
      expect(layout.lanes[0]?.traderName).toBe("Prapor");
    });

    it("sizes a lane by its busiest single layer, not its total task count", () => {
      // Prapor: 4 tasks spread across 4 different layers (a straight chain,
      // one per layer) - never more than 1 node deep at any single layer.
      const p1 = makeTask("p1", [], "Prapor");
      const p2 = makeTask("p2", ["p1"], "Prapor");
      const p3 = makeTask("p3", ["p2"], "Prapor");
      const p4 = makeTask("p4", ["p3"], "Prapor");
      // Skier: 2 tasks both at layer 0 (no prerequisites between them).
      const s1 = makeTask("s1", [], "Skier");
      const s2 = makeTask("s2", [], "Skier");

      const layout = computeQuestTreeLayout([p1, p2, p3, p4, s1, s2], [], new Set(), {
        nodeWidth: 100,
        columnGap: 20,
      });
      const praporLane = layout.lanes.find((lane) => lane.traderName === "Prapor");
      const skierLane = layout.lanes.find((lane) => lane.traderName === "Skier");
      expect(praporLane?.width).toBe(100); // busiest layer for Prapor has exactly 1 node
      expect(skierLane?.width).toBe(2 * 100 + 20); // busiest layer for Skier has 2 nodes
    });

    it("keeps every lane's row heights shared globally, so same-depth tasks in different lanes share the same y", () => {
      const praporTask = makeTask("p", [], "Prapor");
      const skierTask = makeTask("s", [], "Skier");
      const layout = computeQuestTreeLayout([praporTask, skierTask]);
      expect(findNode(layout, "p")?.y).toBe(findNode(layout, "s")?.y);
    });

    it("positions a lane's header over its own top-layer node(s), not the full lane width, when a deeper layer is wider", () => {
      // Layer 0 has a single node (p1); layer 1 fans out to 3 (all requiring
      // p1), which makes the *lane* wider than that lone top-layer node - so
      // p1 renders centered within the lane, offset right of the lane's own
      // `x`. A header drawn at the lane's raw x/width would then sit too far
      // left of where the chain actually starts.
      const p1 = makeTask("p1", [], "Prapor");
      const p2 = makeTask("p2", ["p1"], "Prapor");
      const p3 = makeTask("p3", ["p1"], "Prapor");
      const p4 = makeTask("p4", ["p1"], "Prapor");
      const layout = computeQuestTreeLayout([p1, p2, p3, p4], [], new Set(), {
        nodeWidth: 100,
        columnGap: 20,
      });
      const lane = layout.lanes.find((entry) => entry.traderName === "Prapor");
      const p1Node = findNode(layout, "p1");
      expect(lane?.width).toBe(3 * 100 + 2 * 20); // driven by layer 1's 3 nodes
      expect(lane?.headerX).toBe(p1Node?.x);
      expect(lane?.headerWidth).toBe(100);
    });

    it("packs two lanes by comparing widths row-by-row, so a lane's one long row doesn't push its neighbor away at every row", () => {
      // Prapor: a single task at layer 0, then it fans out to 5 tasks at
      // layer 1 - Prapor's busiest layer (580px) is layer 1 only.
      const p0 = makeTask("p0", [], "Prapor");
      const p1Tasks = ["p1a", "p1b", "p1c", "p1d", "p1e"].map((id) =>
        makeTask(id, ["p0"], "Prapor"),
      );
      // Therapist: a single task at layer 0 only - no layer-1 row at all, so
      // nothing of Therapist's ever needs to clear Prapor's wide layer-1 row.
      const t0 = makeTask("t0", [], "Therapist");

      const options = { nodeWidth: 100, columnGap: 20, laneGap: 48 };
      const layout = computeQuestTreeLayout([p0, ...p1Tasks, t0], [], new Set(), options);

      const praporLane = layout.lanes.find((lane) => lane.traderName === "Prapor");
      const therapistLane = layout.lanes.find((lane) => lane.traderName === "Therapist");
      expect(praporLane?.width).toBe(5 * 100 + 4 * 20); // 580, from layer 1

      // Naive packing (old behavior: sum of each lane's own busiest-layer
      // width + gap) would put Therapist's spine at 580 + 48 + 50 = 678.
      const naivePackedCenter = 580 + 48 + 50;
      const t0Node = findNode(layout, "t0");
      const therapistSpine = (t0Node?.x ?? 0) + 50;
      expect(therapistSpine).toBeLessThan(naivePackedCenter);
      // Row-by-row packing only has to clear Prapor's layer-0 row, not its
      // layer-1 row - but Prapor's own layer-0 row (a lone 100px node) is
      // itself centered under Prapor's wider layer-1 row (580px, since both
      // share Prapor's one spine), so it reaches 340, not just 100. Still a
      // real 240px improvement over the naive 678.
      const praporSpine = 290; // half of Prapor's own busiest row (580) - the first lane hugs x=0
      const praporRow0Right = praporSpine + 50;
      expect(therapistSpine).toBeCloseTo(praporRow0Right + 48 + 50); // 438

      // No overlap: Therapist's leftmost edge still clears Prapor's rightmost
      // edge at every layer they both occupy (only layer 0 here).
      const p0Node = findNode(layout, "p0");
      expect(t0Node?.x).toBeGreaterThanOrEqual((p0Node?.x ?? 0) + 100 + 48);

      // Lane header/width metadata still reflects each lane's OWN busiest
      // layer (unaffected by how close packing pulled a neighbor in).
      expect(therapistLane?.width).toBe(100);
    });

    it("still keeps two lanes fully clear of each other at a row they both occupy", () => {
      // Both traders have a wide row at layer 0 and a narrow row at layer 1 -
      // row-by-row packing must not let layer 1's narrower gap requirement
      // pull the lanes closer than layer 0 (where both are wide) allows.
      const p0Tasks = ["p0a", "p0b", "p0c"].map((id) => makeTask(id, [], "Prapor"));
      const p1 = makeTask("p1", ["p0a", "p0b", "p0c"], "Prapor");
      const t0Tasks = ["t0a", "t0b", "t0c"].map((id) => makeTask(id, [], "Therapist"));
      const t1 = makeTask("t1", ["t0a", "t0b", "t0c"], "Therapist");

      const options = { nodeWidth: 100, columnGap: 20, laneGap: 48 };
      const layout = computeQuestTreeLayout(
        [...p0Tasks, p1, ...t0Tasks, t1],
        [],
        new Set(),
        options,
      );

      for (let layer = 0; layer <= 1; layer += 1) {
        const praporRight = Math.max(
          ...layout.nodes
            .filter((n) => n.laneTrader === "Prapor" && n.layer === layer)
            .map((n) => n.x + n.width),
        );
        const therapistLeft = Math.min(
          ...layout.nodes
            .filter((n) => n.laneTrader === "Therapist" && n.layer === layer)
            .map((n) => n.x),
        );
        expect(therapistLeft - praporRight).toBeGreaterThanOrEqual(48);
      }
    });

    it("keeps a lane clear of an EARLIER non-adjacent lane's wide row, even when the lane directly between them has no row there to pass the constraint on", () => {
      // Prapor (lane 0): a wide row at layer 1 (5 nodes), narrow at layer 0.
      // Therapist (lane 1, sits between Prapor and Skier): a row at layer 0
      // only - nothing at layer 1, so it can't act as a relay for Prapor's
      // layer-1 footprint via simple immediate-neighbor spacing.
      // Skier (lane 2): a row at layer 1 only - the same row Prapor is wide
      // on. Skier's spacing must still be derived from Prapor's layer-1
      // extent, not just from Therapist (which has nothing to compare there).
      const p0 = makeTask("p0", [], "Prapor");
      const p1Tasks = ["p1a", "p1b", "p1c", "p1d", "p1e"].map((id) =>
        makeTask(id, ["p0"], "Prapor"),
      );
      const t0 = makeTask("t0", [], "Therapist");
      const s0 = makeTask("s0", [], "Skier");
      const s1 = makeTask("s1", ["s0"], "Skier");

      const options = { nodeWidth: 100, columnGap: 20, laneGap: 48 };
      const layout = computeQuestTreeLayout([p0, ...p1Tasks, t0, s0, s1], [], new Set(), options);

      const praporLayer1Right = Math.max(
        ...layout.nodes
          .filter((n) => n.laneTrader === "Prapor" && n.layer === 1)
          .map((n) => n.x + n.width),
      );
      const skierLayer1Node = findNode(layout, "s1");
      expect((skierLayer1Node?.x ?? 0) - praporLayer1Right).toBeGreaterThanOrEqual(48);
    });
  });

  describe("collapsible multi-part chains", () => {
    it("renders a chain as exactly one node, not one per member task", () => {
      const p1 = makeTask("p1");
      const p2 = makeTask("p2", ["p1"]);
      const p3 = makeTask("p3", ["p2"]);
      const chain = makeChain(["p1", "p2", "p3"], ["Trader"]);

      const layout = computeQuestTreeLayout([p1, p2, p3], [chain]);
      expect(layout.nodes).toHaveLength(1);
      const node = layout.nodes[0];
      expect(node?.kind).toBe("chain");
      if (node?.kind === "chain") {
        expect(node.taskIds).toEqual(["p1", "p2", "p3"]);
        expect(node.expanded).toBe(false);
        expect(node.parts).toHaveLength(3);
      }
    });

    it("labels each part with its real 'Part N' number, not array position - regression test for a mislabeling bug", () => {
      // A chain whose lowest detected part is real Part 2 (its Part 1 was
      // excluded from the input, e.g. filtered out or dropped for name
      // ambiguity) must still label its parts "Part 2"/"Part 3", matching
      // the task's own name - not "Part 1"/"Part 2" recomputed from array
      // position.
      const p2 = makeTask("p2");
      const p3 = makeTask("p3", ["p2"]);
      const chain = makeChain(["p2", "p3"], ["Trader"], [2, 3]);

      const layout = computeQuestTreeLayout([p2, p3], [chain]);
      const node = layout.nodes[0];
      expect(node?.kind).toBe("chain");
      if (node?.kind === "chain") {
        expect(node.parts.map((part) => part.partNumber)).toEqual([2, 3]);
      }
    });

    it("computes a chain's layer as the union of every member's external prerequisites, not just the first part's", () => {
      const g = makeTask("g"); // external, layer 0
      const p1 = makeTask("p1");
      const p2 = makeTask("p2", ["p1"]);
      // p3's own prerequisite is an EXTERNAL task, not just its internal
      // chain predecessor - the chain as a whole must respect it even
      // though p1 (the chain's "anchor") has no external prerequisite.
      const p3 = makeTask("p3", ["p2", "g"]);
      const chain = makeChain(["p1", "p2", "p3"], ["Trader"]);

      const layout = computeQuestTreeLayout([g, p1, p2, p3], [chain]);
      expect(layerOf(layout, "g")).toBe(0);
      expect(layerOf(layout, "chain:p1")).toBe(1);
    });

    it("routes an external dependent to the chain as a whole even when it targets a non-final part, and preserves the real task id in the edge list", () => {
      const p1 = makeTask("p1");
      const p2 = makeTask("p2", ["p1"]);
      const p3 = makeTask("p3", ["p2"]);
      const dependent = makeTask("dependent-on-part-2", ["p2"]); // targets part 2, not part 3
      const chain = makeChain(["p1", "p2", "p3"], ["Trader"]);

      const layout = computeQuestTreeLayout([p1, p2, p3, dependent], [chain]);
      expect(layout.edges).toEqual([{ fromTaskId: "p2", toTaskId: "dependent-on-part-2" }]);
      expect(layerOf(layout, "dependent-on-part-2")).toBe(1);

      const index = buildEdgeEndpointIndex(layout);
      // Collapsed - "p2" resolves to the chain's own outer box, not a
      // standalone position.
      expect(index.get("p2")).toEqual(findNode(layout, "chain:p1"));
    });

    it("drops internal chain-member edges entirely (never rendered, collapsed or expanded)", () => {
      const p1 = makeTask("p1");
      const p2 = makeTask("p2", ["p1"]);
      const chain = makeChain(["p1", "p2"], ["Trader"]);
      const layout = computeQuestTreeLayout([p1, p2], [chain]);
      expect(layout.edges).toEqual([]);
    });

    it("expanding a chain grows only its own node's height, leaving a sibling lane's row untouched in width and same-layer y", () => {
      const p1 = makeTask("p1", [], "Prapor");
      const p2 = makeTask("p2", ["p1"], "Prapor");
      const p3 = makeTask("p3", ["p2"], "Prapor");
      const chain = makeChain(["p1", "p2", "p3"], ["Prapor"]);
      const skierTask = makeTask("s", [], "Skier"); // same layer (0) as the chain

      const collapsed = computeQuestTreeLayout([p1, p2, p3, skierTask], [chain], new Set());
      const expanded = computeQuestTreeLayout(
        [p1, p2, p3, skierTask],
        [chain],
        new Set(["chain:p1"]),
      );

      // Lane widths are unaffected by expand state - expanding never
      // changes x-position/width, only height.
      expect(expanded.lanes).toEqual(collapsed.lanes);

      const collapsedChainNode = findNode(collapsed, "chain:p1");
      const expandedChainNode = findNode(expanded, "chain:p1");
      expect(expandedChainNode?.height).toBeGreaterThan(collapsedChainNode?.height ?? 0);

      // Both states still start row 0 at the same y for every lane.
      expect(findNode(collapsed, "s")?.y).toBe(findNode(expanded, "s")?.y);
    });

    it("places a cross-trader chain (e.g. real 'Colleagues' Peacekeeper -> Prapor) in its first part's lane", () => {
      const p1 = makeTask("colleagues-1", [], "Peacekeeper");
      const p2 = makeTask("colleagues-2", ["colleagues-1"], "Prapor");
      const chain = makeChain(["colleagues-1", "colleagues-2"], ["Peacekeeper", "Prapor"]);

      const layout = computeQuestTreeLayout([p1, p2], [chain]);
      const node = findNode(layout, "chain:colleagues-1");
      expect(node?.laneTrader).toBe("Peacekeeper");

      const peacekeeperLane = layout.lanes.find((lane) => lane.traderName === "Peacekeeper");
      expect(node?.x).toBe(peacekeeperLane?.x);
    });
  });
});

describe("buildEdgeEndpointIndex", () => {
  it("resolves a standalone task id to its own node", () => {
    const a = makeTask("a");
    const b = makeTask("b", ["a"]);
    const layout = computeQuestTreeLayout([a, b]);
    const index = buildEdgeEndpointIndex(layout);
    expect(index.get("a")).toEqual(findNode(layout, "a"));
    expect(index.get("b")).toEqual(findNode(layout, "b"));
  });

  it("resolves an expanded chain member id to its specific mini-part sub-position, not the chain's outer box", () => {
    const p1 = makeTask("p1");
    const p2 = makeTask("p2", ["p1"]);
    const chain = makeChain(["p1", "p2"], ["Trader"]);
    const layout = computeQuestTreeLayout([p1, p2], [chain], new Set(["chain:p1"]));
    const index = buildEdgeEndpointIndex(layout);
    const node = findNode(layout, "chain:p1");
    expect(node?.kind).toBe("chain");
    if (node?.kind === "chain") {
      expect(index.get("p2")).toEqual(node.parts[1]);
      expect(index.get("p2")).not.toEqual(node);
    }
  });
});

describe("computeChainStackOffsets", () => {
  it("returns no ghost layers for a single-part chain", () => {
    expect(computeChainStackOffsets(1)).toEqual([]);
  });

  it("returns one furthest-first-ordered offset per extra part for a 3-part chain", () => {
    const offsets = computeChainStackOffsets(3);
    expect(offsets).toHaveLength(2);
    expect(offsets[0]?.offsetX).toBeGreaterThan(offsets[1]?.offsetX ?? 0);
    expect(offsets[0]?.offsetY).toBeGreaterThan(offsets[1]?.offsetY ?? 0);
  });

  it("caps the ghost count for a pathologically long chain instead of one-per-part", () => {
    expect(computeChainStackOffsets(8, 3)).toHaveLength(3);
  });
});

describe("buildLaneTraderIndex", () => {
  it("resolves a cross-trader chain member to the chain's own (first part's) lane, not that member's own trader", () => {
    const p1 = makeTask("colleagues-1", [], "Peacekeeper");
    const p2 = makeTask("colleagues-2", ["colleagues-1"], "Prapor");
    const chain = makeChain(["colleagues-1", "colleagues-2"], ["Peacekeeper", "Prapor"]);
    const layout = computeQuestTreeLayout([p1, p2], [chain]);

    const index = buildLaneTraderIndex(layout);
    expect(index.get("colleagues-1")).toBe("Peacekeeper");
    expect(index.get("colleagues-2")).toBe("Peacekeeper");
  });

  it("resolves a standalone task to its own trader's lane", () => {
    const a = makeTask("a", [], "Skier");
    const layout = computeQuestTreeLayout([a]);
    expect(buildLaneTraderIndex(layout).get("a")).toBe("Skier");
  });
});
