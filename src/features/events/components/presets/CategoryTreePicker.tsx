"use client";

import { ChevronRight, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { cn } from "@/shared/ui/lib/cn";

import { INPUT_CLASS } from "../event-ui";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { CatalogCategory } from "../../catalog/catalog-types";

/**
 * The handbook category tree with its icons: expand a branch, click a
 * category to pick it. Typing filters to categories whose name matches,
 * shown with their path so "Rounds" is clearly ammo.
 */
export function CategoryTreePicker({
  index,
  onPick,
  label = "Category",
}: {
  index: CatalogIndex;
  onPick: (category: CatalogCategory) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const searchId = useId();
  const term = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!term) return [];
    return [...index.categoriesById.values()]
      .filter((category) => category.name.toLowerCase().includes(term))
      .slice(0, 30);
  }, [index, term]);

  const pathOf = (category: CatalogCategory): string => {
    const names: string[] = [];
    let current = category.parent ? index.categoriesById.get(category.parent) : undefined;
    while (current) {
      names.unshift(current.name);
      current = current.parent ? index.categoriesById.get(current.parent) : undefined;
    }
    return names.join(" / ");
  };

  const toggle = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  const renderBranch = (parentId: string, depth: number) => (
    // Plain nested lists of buttons rather than an ARIA tree: every control
    // is a real button in tab order, which works without the arrow-key
    // model an ARIA tree promises.
    <ul aria-label={depth === 0 ? label : undefined}>
      {(index.childrenOf.get(parentId) ?? []).map((category) => {
        const children = index.childrenOf.get(category.id) ?? [];
        const expanded = open.has(category.id);
        return (
          <li key={category.id}>
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: `${String(depth * 1.25)}rem` }}
            >
              {children.length > 0 ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground rounded p-1"
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name}`}
                  aria-expanded={expanded}
                  onClick={() => {
                    toggle(category.id);
                  }}
                >
                  <ChevronRight
                    className={cn("size-4 transition-transform", expanded && "rotate-90")}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="w-6" />
              )}
              <button
                type="button"
                className="hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm"
                onClick={() => {
                  onPick(category);
                }}
              >
                <ItemIcon src={category.icon} size="xs" />
                <span className="truncate">{category.name}</span>
              </button>
            </div>
            {expanded && children.length > 0 && renderBranch(category.id, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search categories
        </label>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id={searchId}
          type="search"
          className={`${INPUT_CLASS} pl-9`}
          placeholder="Search categories, e.g. rigs"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      <div className="border-border max-h-72 overflow-y-auto rounded-md border p-1">
        {term ? (
          matches.length === 0 ? (
            <p className="text-muted-foreground p-2 text-sm">No categories match.</p>
          ) : (
            <ul aria-label={`${label} matches`}>
              {matches.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    className="hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm"
                    onClick={() => {
                      onPick(category);
                      setQuery("");
                    }}
                  >
                    <ItemIcon src={category.icon} size="xs" />
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {pathOf(category)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          renderBranch("", 0)
        )}
      </div>
    </div>
  );
}
