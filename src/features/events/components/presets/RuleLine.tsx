"use client";

import { Badge } from "@/shared/ui/badge/Badge";

import { STAT_LABELS } from "../../lib/presets";

import { TargetChip } from "./TargetChip";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { PresetRule, RuleTarget } from "../../types";
import type { ReactNode } from "react";

/** Naming helpers a rule line needs. */
export interface RuleLineNames {
  item: (itemId: string) => string;
  icon: (itemId: string) => string | null;
}

const KIND_BADGE: Readonly<
  Record<
    PresetRule["kind"],
    { label: string; variant: "red" | "green" | "amber" | "teal" | "outline" }
  >
> = {
  ban: { label: "Banned", variant: "red" },
  allow: { label: "Allowed", variant: "green" },
  allowOnly: { label: "Only", variant: "amber" },
  cap: { label: "Limit", variant: "amber" },
  require: { label: "Required", variant: "teal" },
  stat: { label: "Stat", variant: "outline" },
};

function rangeText(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${String(min)} to ${String(max)}`;
  if (max !== undefined) return `${String(max)} or lower`;
  return `${String(min ?? 0)} or higher`;
}

/**
 * One preset rule, laid out with icons: a colored badge for what kind of
 * rule it is, then the categories and items it names. `actions` slots in
 * controls (the editor's remove button).
 */
export function RuleLine({
  rule,
  index,
  names,
  actions,
  highlighted = false,
}: {
  rule: PresetRule;
  index: CatalogIndex | null;
  names: RuleLineNames;
  actions?: ReactNode;
  /** Marks a rule the current kit breaks. */
  highlighted?: boolean;
}) {
  const chip = (target: RuleTarget, key?: string) => (
    <TargetChip
      key={key}
      target={target}
      index={index}
      itemName={names.item}
      itemIcon={names.icon}
    />
  );
  const badge = KIND_BADGE[rule.kind];

  let body: ReactNode;
  switch (rule.kind) {
    case "ban":
    case "allow":
      body = chip(rule.target);
      break;
    case "allowOnly":
      body = (
        <>
          {chip(rule.scope)}
          <span className="text-muted-foreground text-sm">only</span>
          {rule.allowed.length === 0 ? (
            <span className="text-sm">nothing</span>
          ) : (
            rule.allowed.map((target, i) =>
              chip(target, `${target.type}:${target.id}:${String(i)}`),
            )
          )}
        </>
      );
      break;
    case "cap":
      body = (
        <>
          <span className="text-sm font-semibold">
            {rule.max === 0 ? "None of" : `At most ${String(rule.max)}×`}
          </span>
          {chip(rule.target)}
        </>
      );
      break;
    case "require":
      body = (
        <>
          <span className="text-sm font-semibold">At least {rule.min}×</span>
          {chip(rule.target)}
        </>
      );
      break;
    case "stat":
      body = (
        <>
          {chip(rule.appliesTo)}
          <span className="text-sm">
            {STAT_LABELS[rule.stat]} {rangeText(rule.min, rule.max)}
          </span>
        </>
      );
      break;
  }

  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 ${highlighted ? "bg-status-red-soft" : ""}`}
    >
      <Badge variant={badge.variant} className="w-20 justify-center">
        {badge.label}
      </Badge>
      {body}
      {rule.note && <span className="text-muted-foreground text-xs italic">{rule.note}</span>}
      {actions && <span className="ml-auto">{actions}</span>}
    </li>
  );
}
