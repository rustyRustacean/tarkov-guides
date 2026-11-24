"use client";

import { Search, X } from "lucide-react";
import { useId, useState } from "react";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";
import { formatRoubles } from "@/shared/lib/format-roubles";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { QuantityStepper } from "@/shared/ui/quantity-stepper/QuantityStepper";

import { fleaPriceForMode, isFleaBanned, searchFeeItems, summarizeFleaSale } from "../lib/flea-fee";

import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

const INPUT_CLASS =
  "border-border bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60";

/** The largest stack the quantity control accepts. Generous on purpose: ammo sells in the hundreds. */
const MAX_QUANTITY = 9999;

/** A whole, positive rouble amount from the price field, or `null` while it's blank or invalid. */
function parseListPrice(value: string): number | null {
  const digits = value.replace(/[\s,₽]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  const price = Number(digits);
  return price > 0 ? price : null;
}

/**
 * Flea market listing fee calculator: search an item, set a price and a
 * stack size, see the fee and what's left. Prices come from the header's
 * game mode, since each mode runs its own flea market. The suggested price
 * is filled in when an item is picked, not kept in sync afterwards, so a
 * mode switch never overwrites a price someone typed.
 */
export function FleaFeeCalculator() {
  const { data, isPending } = useTarkovGameData();
  const mode = useProgressTrackerStore((state) => state.activeMode);
  const modeLabel = PROFILE_MODE_LABELS[mode];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [quantity, setQuantity] = useState(1);

  const searchId = useId();
  const resultsId = useId();
  const priceId = useId();

  const items = data?.items;
  const results = items ? searchFeeItems(items, query) : [];
  const selected = items?.find((item) => item.id === selectedId) ?? null;
  const marketPrice = selected ? fleaPriceForMode(selected, mode) : null;
  const listPrice = parseListPrice(priceInput);
  const summary =
    selected && listPrice !== null
      ? summarizeFleaSale(selected.basePrice, listPrice, quantity)
      : null;
  const traderTotal = selected && selected.traderSell > 0 ? selected.traderSell * quantity : null;

  function pick(item: NormalizedItem): void {
    setSelectedId(item.id);
    setQuery("");
    const suggested = fleaPriceForMode(item, mode);
    setPriceInput(suggested === null ? "" : String(Math.round(suggested)));
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2">
            <label htmlFor={searchId} className="text-sm font-medium">
              Item
            </label>
            <div className="relative">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder={isPending ? "Loading items…" : "Search by name, e.g. LEDX or GPU"}
                disabled={!items}
                autoComplete="off"
                aria-controls={resultsId}
                className={`${INPUT_CLASS} pl-9`}
              />
            </div>
            <ul id={resultsId} aria-label="Matching items" className="flex flex-col gap-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(item);
                    }}
                    className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <ItemIcon src={item.iconLink} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{item.shortName}</span>
                  </button>
                </li>
              ))}
            </ul>
            {query.trim() && items && results.length === 0 && (
              <p className="text-muted-foreground text-sm">No items match “{query.trim()}”.</p>
            )}
          </div>

          {selected ? (
            <div className="border-border bg-background/40 flex items-center gap-3 rounded-md border p-3">
              <ItemIcon src={selected.iconLink} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{selected.name}</div>
                <dl className="text-muted-foreground mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs tabular-nums">
                  <dt>Base price</dt>
                  <dd>{formatRoubles(selected.basePrice)}</dd>
                  <dt>Flea 24h avg ({modeLabel})</dt>
                  <dd>{marketPrice === null ? "No data" : formatRoubles(marketPrice)}</dd>
                </dl>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear item"
                onClick={() => {
                  setSelectedId(null);
                  setPriceInput("");
                }}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Pick an item to fill in its base price and current {modeLabel} flea price.
            </p>
          )}

          {selected && isFleaBanned(selected) && (
            <p role="note" className="text-status-red text-sm">
              tarkov.dev marks this item as not sellable on the flea market.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-48 flex-1 flex-col gap-2">
              <label htmlFor={priceId} className="text-sm font-medium">
                List price per item (₽)
              </label>
              <input
                id={priceId}
                type="text"
                inputMode="numeric"
                value={priceInput}
                onChange={(event) => {
                  setPriceInput(event.target.value);
                }}
                disabled={!selected}
                placeholder={selected ? "Enter a price" : "Pick an item first"}
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" aria-hidden="true">
                Quantity
              </span>
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={MAX_QUANTITY}
                label="Quantity"
                className="h-9"
              />
            </div>
          </div>
          {selected && marketPrice !== null && listPrice !== Math.round(marketPrice) && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                setPriceInput(String(Math.round(marketPrice)));
              }}
            >
              Use the {modeLabel} 24h average ({formatRoubles(marketPrice)})
            </Button>
          )}
        </CardContent>
      </Card>

      <Card aria-live="polite">
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {summary ? (
            <>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm tabular-nums">
                <dt className="text-muted-foreground">Sale total</dt>
                <dd className="text-right">{formatRoubles(summary.gross)}</dd>
                <dt className="text-muted-foreground">Listing fee</dt>
                <dd className="text-status-red text-right">
                  {formatRoubles(summary.fee)}
                  <span className="text-muted-foreground ml-1 text-xs">
                    ({(summary.feeShare * 100).toFixed(1)}%)
                  </span>
                </dd>
                <dt className="font-medium">You keep</dt>
                <dd className="text-status-green text-right text-lg font-semibold">
                  {formatRoubles(summary.net)}
                </dd>
              </dl>
              {traderTotal !== null && selected && (
                <p className="border-border border-t pt-3 text-sm">
                  {selected.traderSellVendor || "The best trader"} pays{" "}
                  <span className="tabular-nums">{formatRoubles(traderTotal)}</span>
                  {traderTotal >= summary.net
                    ? ", which beats this listing after the fee."
                    : ", so the flea comes out ahead."}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              {selected ? "Enter a list price to see the fee." : "Pick an item to get started."}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            The fee assumes no Intel Center or Hideout Management discount, so yours may be lower.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
