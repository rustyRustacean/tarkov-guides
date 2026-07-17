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

function makeChain(taskIds: readonly string[], traderNames: readonly string[]): QuestChain {
  const firstTaskId = taskIds[0];
  if (firstTaskId === undefined) throw new Error("makeChain requires at least one task id");
  return {
    chainId: `chain:${firstTaskId}`,
    baseName: "Chain",
    taskIds,
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
