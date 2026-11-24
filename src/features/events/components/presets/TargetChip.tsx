"use client";

import { FolderTree } from "lucide-react";

import { ItemIcon } from "@/shared/ui/item-icon/ItemIcon";
import { cn } from "@/shared/ui/lib/cn";

import type { CatalogIndex } from "../../catalog/catalog-index";
import type { RuleTarget } from "../../types";
import type { ReactNode } from "react";

/** A rule target as a small pill: its icon (an item's, or a category's handbook icon) and name. */
export function TargetChip({
  target,
  index,
  itemName,
  itemIcon,
  className,
  children,
}: {
  target: RuleTarget;
  index: CatalogIndex | null;
  itemName: (itemId: string) => string;
  itemIcon: (itemId: string) => string | null;
  className?: string;
  /** Extra controls inside the pill, e.g. a remove button. */
  children?: ReactNode;
}) {
  const category = target.type === "category" ? index?.categoriesById.get(target.id) : undefined;
  const name =
    target.type === "item" ? itemName(target.id) : (category?.name ?? "Unknown category");
  const icon = target.type === "item" ? itemIcon(target.id) : (category?.icon ?? null);

  return (
    <span
      className={cn(
        "border-border bg-muted/50 inline-flex max-w-full items-center gap-1.5 rounded-md border py-0.5 pr-2 pl-1 text-sm",
        className,
      )}
    >
      {icon ? (
        <ItemIcon src={icon} size="xs" />
      ) : (
        <FolderTree className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{name}</span>
      {target.type === "category" && <span className="sr-only">(category)</span>}
      {children}
    </span>
  );
}
