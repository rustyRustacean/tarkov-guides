"use client";

import { useState } from "react";

import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { ItemPicker } from "../ItemPicker";

import { CategoryTreePicker } from "./CategoryTreePicker";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { RuleTarget } from "../../types";

/** Pick a rule target: a whole category from the handbook tree, or one item by search. */
export function TargetPicker({
  index,
  onPick,
  categoriesOnly = false,
  label,
}: {
  index: CatalogIndex;
  onPick: (target: RuleTarget) => void;
  /** Some rules only make sense for a category (an allow-only scope, a stat limit). */
  categoriesOnly?: boolean;
  label: string;
}) {
  const [mode, setMode] = useState<"category" | "item">("category");
  const showItems = !categoriesOnly && mode === "item";

  return (
    <div className="flex flex-col gap-2">
      {!categoriesOnly && (
        <SegmentedControl
          aria-label={`${label}: category or item`}
          className="max-w-xs"
          options={[
            { value: "category", label: "Category" },
            { value: "item", label: "Item" },
          ]}
          value={mode}
          onChange={setMode}
        />
      )}
      {showItems ? (
        <ItemPicker
          label={label}
          placeholder="Search items, e.g. Propital"
          accept={(item) => !item.types.includes("preset")}
          onPick={(item) => {
            onPick({ type: "item", id: item.id });
          }}
        />
      ) : (
        <CategoryTreePicker
          index={index}
          label={label}
          onPick={(category) => {
            onPick({ type: "category", id: category.id });
          }}
        />
      )}
    </div>
  );
}
