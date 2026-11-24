"use client";

import { CheckCircle2, Copy, Link2, Trash2, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { cn } from "@/shared/ui/lib/cn";
import { QuantityStepper } from "@/shared/ui/quantity-stepper/QuantityStepper";
import { toast } from "@/shared/ui/toast/toast-store";

import { AMMO_SLUGS, categoryFilter, SLOT_RULES } from "../../lib/kit-slots";
import { KIT_SLOT_KEYS, PRESET_LIMITS } from "../../lib/preset-schema";
import { checkKit, KIT_SLOT_LABELS, type Namer } from "../../lib/presets";
import { ItemPicker } from "../ItemPicker";

import { PresetSummary } from "./PresetSummary";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { Kit, KitSlot, KitSlotKey, Preset } from "../../types";
import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

type KitNames = Namer & { icon: (itemId: string) => string | null };

function notPreset(item: NormalizedItem): boolean {
  return !item.types.includes("preset");
}

/** An item in the kit: icon, name, and a red ring when it breaks a rule. */
function KitItem({
  itemId,
  names,
  bad,
  onRemove,
  children,
}: {
  itemId: string;
  names: KitNames;
  bad: boolean;
  onRemove: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border flex items-center gap-2 rounded-md border px-2 py-1.5",
        bad && "border-status-red ring-status-red/40 ring-2",
      )}
    >
      <ItemIcon src={names.icon(itemId)} size="sm" />
      <span className="min-w-0 flex-1 truncate text-sm">{names.item(itemId)}</span>
      {bad && <XCircle className="text-status-red size-4 shrink-0" aria-label="Breaks a rule" />}
      {children}
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Remove ${names.item(itemId)}`}
        onClick={onRemove}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function SlotCard({
  slotKey,
  slot,
  index,
  names,
  badItems,
  onChange,
}: {
  slotKey: KitSlotKey;
  slot: KitSlot | undefined;
  index: CatalogIndex;
  names: KitNames;
  badItems: ReadonlySet<string>;
  onChange: (slot: KitSlot | undefined) => void;
}) {
  const rules = SLOT_RULES[slotKey];
  const label = KIT_SLOT_LABELS[slotKey];
  const fitsSlot = useMemo(() => categoryFilter(index, rules.item), [index, rules.item]);
  const fitsAttachment = useMemo(
    () => categoryFilter(index, rules.attachments),
    [index, rules.attachments],
  );
  const isAmmo = useMemo(() => categoryFilter(index, AMMO_SLUGS), [index]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {slot ? (
          <KitItem
            itemId={slot.itemId}
            names={names}
            bad={badItems.has(slot.itemId)}
            onRemove={() => {
              onChange(undefined);
            }}
          />
        ) : (
          <ItemPicker
            label={label}
            placeholder={`Add ${label.toLowerCase()}`}
            accept={(item) => notPreset(item) && fitsSlot(item.id)}
            onPick={(item) => {
              onChange({ itemId: item.id, attachments: [] });
            }}
          />
        )}

        {slot && rules.attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 pl-3">
            {slot.attachments.map((attachmentId, i) => (
              <KitItem
                key={`${attachmentId}-${String(i)}`}
                itemId={attachmentId}
                names={names}
                bad={badItems.has(attachmentId)}
                onRemove={() => {
                  onChange({ ...slot, attachments: slot.attachments.filter((_, j) => j !== i) });
                }}
              />
            ))}
            {slot.attachments.length < PRESET_LIMITS.attachments && (
              <ItemPicker
                label={`${label} attachment`}
                placeholder={
                  rules.ammo ? "Add a mod (scope, suppressor...)" : "Add a plate, visor or mount"
                }
                accept={(item) => notPreset(item) && fitsAttachment(item.id)}
                onPick={(item) => {
                  onChange({ ...slot, attachments: [...slot.attachments, item.id] });
                }}
              />
            )}
          </div>
        )}

        {slot && rules.ammo && (
          <div className="flex flex-col gap-1.5 pl-3">
            {slot.ammo ? (
              <KitItem
                itemId={slot.ammo.itemId}
                names={names}
                bad={badItems.has(slot.ammo.itemId)}
                onRemove={() => {
                  onChange({ itemId: slot.itemId, attachments: slot.attachments });
                }}
              >
                <QuantityStepper
                  label={`${label} ammo`}
                  value={slot.ammo.qty}
                  min={1}
                  max={PRESET_LIMITS.maxQty}
                  onChange={(qty) => {
                    if (slot.ammo) onChange({ ...slot, ammo: { itemId: slot.ammo.itemId, qty } });
                  }}
                />
              </KitItem>
            ) : (
              <ItemPicker
                label={`${label} ammo`}
                placeholder="Add loaded ammo"
                accept={(item) => isAmmo(item.id)}
                onPick={(item) => {
                  onChange({ ...slot, ammo: { itemId: item.id, qty: 30 } });
                }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Builds a kit and checks it against a preset as it changes: gear slots
 * (with weapon mods, plates, visors and loaded ammo), then everything else
 * carried. Items that break a rule get a red ring, and the check panel
 * lists every broken rule with what broke it. "Copy kit link" packs the kit
 * into a link to send to the organizers; nothing is stored anywhere.
 */
export function KitBuilder({
  kit,
  onKitChange,
  preset,
  index,
  names,
  kitLink,
}: {
  kit: Kit;
  onKitChange: (kit: Kit) => void;
  preset: Preset | null;
  index: CatalogIndex;
  names: KitNames;
  /** Builds the shareable link for a kit. */
  kitLink: (kit: Kit) => Promise<string>;
}) {
  const [copying, setCopying] = useState(false);
  const check = useMemo(
    () => (preset ? checkKit(kit, preset, index, names) : null),
    [kit, preset, index, names],
  );
  const badItems = useMemo(
    () => new Set(check?.violations.flatMap((violation) => violation.itemIds) ?? []),
    [check],
  );
  const brokenRules = useMemo(
    () => new Set(check?.violations.map((violation) => violation.ruleId) ?? []),
    [check],
  );

  const setSlot = (key: KitSlotKey, slot: KitSlot | undefined) => {
    const slots: Kit["slots"] = Object.fromEntries(
      Object.entries(kit.slots).filter(([existing]) => existing !== key),
    );
    if (slot) slots[key] = slot;
    onKitChange({ ...kit, slots });
  };

  const copyLink = async () => {
    setCopying(true);
    try {
      const ok = await copyToClipboard(await kitLink(kit));
      toast({ message: ok ? "Kit link copied" : "Couldn't copy the link." });
    } finally {
      setCopying(false);
    }
  };

  const empty = Object.keys(kit.slots).length === 0 && kit.carried.length === 0;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {check && !empty && (
          // Below `xl` the check panel sits after every slot; this keeps the
          // verdict in view while building on a phone.
          <a
            href="#kit-check"
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium xl:hidden",
              check.ok
                ? "border-status-green text-status-green"
                : "border-status-red text-status-red",
            )}
          >
            {check.ok ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <XCircle className="size-4" aria-hidden="true" />
            )}
            {check.ok
              ? "No problems: see the rules below"
              : `${String(check.violations.length)} ${check.violations.length === 1 ? "problem" : "problems"}: see the list below`}
          </a>
        )}
        <section aria-labelledby="kit-gear" className="flex flex-col gap-3">
          <h2 id="kit-gear" className="font-display text-xl font-bold">
            Gear
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {KIT_SLOT_KEYS.map((key) => (
              <SlotCard
                key={key}
                slotKey={key}
                slot={kit.slots[key]}
                index={index}
                names={names}
                badItems={badItems}
                onChange={(slot) => {
                  setSlot(key, slot);
                }}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="kit-carried" className="flex flex-col gap-3">
          <h2 id="kit-carried" className="font-display text-xl font-bold">
            Carried
          </h2>
          <p className="text-muted-foreground text-sm">
            Everything in your rig, backpack, pockets and secure container: meds, stims, grenades,
            spare ammo.
          </p>
          <div className="flex max-w-2xl flex-col gap-1.5">
            {kit.carried.map((stack, i) => (
              <KitItem
                key={stack.itemId}
                itemId={stack.itemId}
                names={names}
                bad={badItems.has(stack.itemId)}
                onRemove={() => {
                  onKitChange({ ...kit, carried: kit.carried.filter((_, j) => j !== i) });
                }}
              >
                <QuantityStepper
                  label={names.item(stack.itemId)}
                  value={stack.qty}
                  min={1}
                  max={PRESET_LIMITS.maxQty}
                  onChange={(qty) => {
                    onKitChange({
                      ...kit,
                      carried: kit.carried.map((other, j) => (j === i ? { ...other, qty } : other)),
                    });
                  }}
                />
              </KitItem>
            ))}
            {kit.carried.length < PRESET_LIMITS.carried && (
              <ItemPicker
                label="Carried item"
                placeholder="Add an item, e.g. Salewa"
                accept={notPreset}
                onPick={(item) => {
                  const existing = kit.carried.find((stack) => stack.itemId === item.id);
                  onKitChange({
                    ...kit,
                    carried: existing
                      ? kit.carried.map((stack) =>
                          stack.itemId === item.id ? { ...stack, qty: stack.qty + 1 } : stack,
                        )
                      : [...kit.carried, { itemId: item.id, qty: 1 }],
                  });
                }}
              />
            )}
          </div>
        </section>
      </div>

      <aside
        id="kit-check"
        className="flex scroll-mt-24 flex-col gap-4 xl:sticky xl:top-[calc(var(--header-height)+1rem)] xl:self-start"
      >
        <Card className={cn(check && (check.ok ? "border-status-green" : "border-status-red"))}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {check === null ? (
                "No preset"
              ) : check.ok ? (
                <>
                  <CheckCircle2 className="text-status-green size-5" aria-hidden="true" />
                  {empty ? "Nothing to check yet" : "Kit follows the preset"}
                </>
              ) : (
                <>
                  <XCircle className="text-status-red size-5" aria-hidden="true" />
                  {check.violations.length} {check.violations.length === 1 ? "problem" : "problems"}
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {check && check.violations.length > 0 && (
              <ul className="flex flex-col gap-2" aria-label="Problems">
                {check.violations.map((violation) => (
                  <li key={violation.ruleId} className="flex flex-col gap-1 text-sm">
                    <span className="text-status-red font-medium">{violation.message}</span>
                    {violation.itemIds.length > 0 && (
                      <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        {violation.itemIds.map((itemId) => (
                          <span key={itemId} className="inline-flex items-center gap-1">
                            <ItemIcon src={names.icon(itemId)} size="xs" />
                            {names.item(itemId)}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={copying || empty}
                onClick={() => {
                  void copyLink();
                }}
              >
                {copying ? (
                  <Link2 className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                Copy kit link
              </Button>
              <Button
                variant="ghost"
                disabled={empty}
                onClick={() => {
                  onKitChange({ slots: {}, carried: [] });
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Clear kit
              </Button>
            </div>
          </CardContent>
        </Card>

        {preset && (
          <Card>
            <CardHeader>
              <CardTitle>{preset.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <PresetSummary
                preset={preset}
                index={index}
                names={names}
                brokenRuleIds={brokenRules}
              />
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
