"use client";

import { Search } from "lucide-react";
import { useId, useState } from "react";

import { searchItems } from "@/shared/lib/item-search";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";

import { INPUT_CLASS } from "./event-ui";

import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

/**
 * Search box over tarkov.dev's items, listing matches with their icons.
 * Picking one calls `onPick` and clears the search. `accept` narrows which
 * items can be found (e.g. only weapons for a weapon slot).
 */
export function ItemPicker({
  label,
  placeholder = "Search items",
  onPick,
  accept,
}: {
  label: string;
  placeholder?: string;
  onPick: (item: NormalizedItem) => void;
  accept?: (item: NormalizedItem) => boolean;
}) {
  const { data, isPending } = useTarkovGameData();
  const [query, setQuery] = useState("");
  const inputId = useId();
  const listId = useId();
  const results = data
    ? searchItems(data.items, query, accept ? { limit: 8, accept } : { limit: 8 })
    : [];

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className={`${INPUT_CLASS} pl-9`}
          placeholder={isPending ? "Loading items..." : placeholder}
          disabled={isPending}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} results`}
          className="border-border bg-card absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-md border shadow-lg"
        >
          {results.map((item) => (
            <li key={item.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left text-sm focus-visible:outline-none"
                onClick={() => {
                  onPick(item);
                  setQuery("");
                }}
              >
                <ItemIcon src={item.iconLink} size="sm" />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-muted-foreground text-xs">{item.shortName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
