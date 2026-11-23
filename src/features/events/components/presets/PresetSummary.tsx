"use client";

import { RuleLine, type RuleLineNames } from "./RuleLine";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { Preset } from "../../types";

/** A preset's rules, read-only, with icons. Rules the current kit breaks can be highlighted. */
export function PresetSummary({
  preset,
  index,
  names,
  brokenRuleIds,
}: {
  preset: Preset;
  index: CatalogIndex | null;
  names: RuleLineNames;
  brokenRuleIds?: ReadonlySet<string>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {preset.description && <p className="text-muted-foreground text-sm">{preset.description}</p>}
      {preset.rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">No restrictions.</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={`${preset.name} rules`}>
          {preset.rules.map((rule) => (
            <RuleLine
              key={rule.id}
              rule={rule}
              index={index}
              names={names}
              highlighted={brokenRuleIds?.has(rule.id) ?? false}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
