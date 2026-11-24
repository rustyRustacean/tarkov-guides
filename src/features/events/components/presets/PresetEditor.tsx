"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";

import { newId } from "../../lib/defaults";
import { PRESET_LIMITS } from "../../lib/preset-schema";
import { STAT_LABELS } from "../../lib/presets";
import { INPUT_CLASS, LABEL_CLASS } from "../event-ui";
import { NumberField } from "../NumberField";

import { RuleLine, type RuleLineNames } from "./RuleLine";
import { TargetChip } from "./TargetChip";
import { TargetPicker } from "./TargetPicker";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { Preset, PresetRule, PresetStat, RuleTarget } from "../../types";

type RuleKind = PresetRule["kind"];

const KIND_OPTIONS: readonly { value: RuleKind; label: string; help: string }[] = [
  { value: "ban", label: "Ban", help: "Nothing from this category, or this item, may be brought." },
  {
    value: "allow",
    label: "Allow (exception)",
    help: "Makes an exception to a broader ban, e.g. ban Tactical rigs but allow one specific rig.",
  },
  {
    value: "allowOnly",
    label: "Only allow",
    help: "Inside a category, only the listed items or sub-categories, e.g. Weapons: only Bolt-action rifles.",
  },
  {
    value: "cap",
    label: "Limit quantity",
    help: "At most this many in the whole kit, e.g. 1× Morphine.",
  },
  { value: "require", label: "Require", help: "The kit must include at least this many." },
  {
    value: "stat",
    label: "Stat limit",
    help: "Items in a category must have a stat in range, e.g. Body armor: armor class 4 or lower.",
  },
];

const STAT_OPTIONS: readonly PresetStat[] = ["armorClass", "ammoPen", "ammoDamage"];

function sameTarget(a: RuleTarget, b: RuleTarget): boolean {
  return a.type === b.type && a.id === b.id;
}

/** The "add a rule" form: pick a kind, then whatever that kind needs. */
function RuleBuilder({
  index,
  names,
  onAdd,
}: {
  index: CatalogIndex;
  names: RuleLineNames;
  onAdd: (rule: PresetRule) => void;
}) {
  const [kind, setKind] = useState<RuleKind>("ban");
  const [target, setTarget] = useState<RuleTarget | null>(null);
  const [allowed, setAllowed] = useState<RuleTarget[]>([]);
  const [amount, setAmount] = useState(1);
  const [stat, setStat] = useState<PresetStat>("armorClass");
  const [statMin, setStatMin] = useState<number | null>(null);
  const [statMax, setStatMax] = useState<number | null>(4);
  const [note, setNote] = useState("");
  const kindId = useId();
  const noteId = useId();

  const needsCategory = kind === "allowOnly" || kind === "stat";
  const help = KIND_OPTIONS.find((option) => option.value === kind)?.help ?? "";

  const reset = () => {
    setTarget(null);
    setAllowed([]);
    setNote("");
  };

  const build = (): PresetRule | null => {
    if (!target) return null;
    const base = { id: newId(), ...(note.trim() ? { note: note.trim() } : {}) };
    switch (kind) {
      case "ban":
      case "allow":
        return { ...base, kind, target };
      case "allowOnly":
        return target.type === "category" && allowed.length > 0
          ? { ...base, kind, scope: target, allowed }
          : null;
      case "cap":
        return { ...base, kind, target, max: amount };
      case "require":
        return amount >= 1 ? { ...base, kind, target, min: amount } : null;
      case "stat":
        if (target.type !== "category" || (statMin === null && statMax === null)) return null;
        return {
          ...base,
          kind,
          stat,
          appliesTo: target,
          ...(statMin === null ? {} : { min: statMin }),
          ...(statMax === null ? {} : { max: statMax }),
        };
    }
  };
  const rule = build();

  const chip = (value: RuleTarget, onRemove: () => void) => (
    <TargetChip
      key={`${value.type}:${value.id}`}
      target={value}
      index={index}
      itemName={names.item}
      itemIcon={names.icon}
    >
      <button
        type="button"
        aria-label="Remove"
        className="hover:text-foreground text-muted-foreground"
        onClick={onRemove}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </TargetChip>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-sm flex-col gap-1">
        <label htmlFor={kindId} className={LABEL_CLASS}>
          Rule
        </label>
        <select
          id={kindId}
          className={INPUT_CLASS}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as RuleKind);
            reset();
          }}
        >
          {KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs">{help}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>
          {kind === "allowOnly" ? "In this category" : kind === "stat" ? "For items in" : "What"}
        </span>
        {target ? (
          <div>
            {chip(target, () => {
              setTarget(null);
            })}
          </div>
        ) : (
          <TargetPicker
            index={index}
            categoriesOnly={needsCategory}
            label={kind === "allowOnly" ? "Category to restrict" : "Rule target"}
            onPick={setTarget}
          />
        )}
      </div>

      {kind === "allowOnly" && target && (
        <div className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>Only these</span>
          {allowed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allowed.map((value) =>
                chip(value, () => {
                  setAllowed(allowed.filter((other) => !sameTarget(other, value)));
                }),
              )}
            </div>
          )}
          {allowed.length < PRESET_LIMITS.allowed && (
            <TargetPicker
              index={index}
              label="Allowed item or category"
              onPick={(value) => {
                if (!allowed.some((other) => sameTarget(other, value)))
                  setAllowed([...allowed, value]);
              }}
            />
          )}
        </div>
      )}

      {(kind === "cap" || kind === "require") && (
        <div className="flex items-center gap-2 text-sm">
          <span>{kind === "cap" ? "At most" : "At least"}</span>
          <NumberField
            aria-label={kind === "cap" ? "Maximum" : "Minimum"}
            className="w-24"
            integer
            min={kind === "cap" ? 0 : 1}
            max={PRESET_LIMITS.maxQty}
            value={amount}
            onChange={setAmount}
          />
          <span>in the whole kit</span>
        </div>
      )}

      {kind === "stat" && (
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Stat</span>
            <select
              className={INPUT_CLASS}
              value={stat}
              onChange={(event) => {
                setStat(event.target.value as PresetStat);
              }}
            >
              {STAT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {STAT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Lowest (blank for none)</span>
            <input
              type="number"
              aria-label="Lowest allowed"
              className={`${INPUT_CLASS} no-spinner w-28`}
              min={0}
              value={statMin ?? ""}
              onChange={(event) => {
                setStatMin(event.target.value === "" ? null : Number(event.target.value));
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Highest (blank for none)</span>
            <input
              type="number"
              aria-label="Highest allowed"
              className={`${INPUT_CLASS} no-spinner w-28`}
              min={0}
              value={statMax ?? ""}
              onChange={(event) => {
                setStatMax(event.target.value === "" ? null : Number(event.target.value));
              }}
            />
          </div>
        </div>
      )}

      <div className="flex max-w-xl flex-col gap-1">
        <label htmlFor={noteId} className={LABEL_CLASS}>
          Note (optional)
        </label>
        <input
          id={noteId}
          className={INPUT_CLASS}
          maxLength={PRESET_LIMITS.note}
          placeholder="Shown with the rule"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>

      <Button
        type="button"
        className="self-start"
        disabled={!rule}
        onClick={() => {
          if (!rule) return;
          onAdd(rule);
          reset();
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add rule
      </Button>
    </div>
  );
}

/**
 * Edits one preset: its name, description and rules. Controlled: the
 * parent owns the preset and decides when to save it (the event's Presets
 * tab saves to the room; My presets saves to this browser).
 */
export function PresetEditor({
  preset,
  onChange,
  index,
  names,
}: {
  preset: Preset;
  onChange: (preset: Preset) => void;
  index: CatalogIndex;
  names: RuleLineNames;
}) {
  const nameId = useId();
  const descriptionId = useId();
  const atLimit = preset.rules.length >= PRESET_LIMITS.rules;

  const move = (from: number, to: number) => {
    const rules = [...preset.rules];
    const [moved] = rules.splice(from, 1);
    if (!moved) return;
    rules.splice(to, 0, moved);
    onChange({ ...preset, rules });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Preset</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor={nameId} className={LABEL_CLASS}>
              Name
            </label>
            <input
              id={nameId}
              className={INPUT_CLASS}
              maxLength={PRESET_LIMITS.name}
              placeholder="e.g. Bolt-action specialist"
              value={preset.name}
              onChange={(event) => {
                onChange({ ...preset, name: event.target.value });
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={descriptionId} className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              id={descriptionId}
              className={`${INPUT_CLASS} min-h-20`}
              maxLength={PRESET_LIMITS.description}
              value={preset.description}
              onChange={(event) => {
                onChange({ ...preset, description: event.target.value });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className={LABEL_CLASS}>Rules ({preset.rules.length})</span>
            {preset.rules.length === 0 ? (
              <p className="text-muted-foreground text-sm">No rules yet: everything is allowed.</p>
            ) : (
              <ul className="flex flex-col gap-1" aria-label="Rules">
                {preset.rules.map((rule, i) => (
                  <RuleLine
                    key={rule.id}
                    rule={rule}
                    index={index}
                    names={names}
                    actions={
                      <span className="flex">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Move rule up"
                          disabled={i === 0}
                          onClick={() => {
                            move(i, i - 1);
                          }}
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Move rule down"
                          disabled={i === preset.rules.length - 1}
                          onClick={() => {
                            move(i, i + 1);
                          }}
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove rule"
                          onClick={() => {
                            onChange({
                              ...preset,
                              rules: preset.rules.filter((other) => other.id !== rule.id),
                            });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add a rule</CardTitle>
        </CardHeader>
        <CardContent>
          {atLimit ? (
            <p className="text-muted-foreground text-sm">
              This preset has the most rules allowed ({PRESET_LIMITS.rules}).
            </p>
          ) : (
            <RuleBuilder
              index={index}
              names={names}
              onAdd={(rule) => {
                onChange({ ...preset, rules: [...preset.rules, rule] });
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
