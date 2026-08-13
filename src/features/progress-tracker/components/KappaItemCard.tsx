import { Badge } from "@/shared/ui/badge/Badge";

import type { KappaItem } from "../lib/kappa";

export interface KappaItemCardProps {
  item: KappaItem;
  /** Mid the 1.5s transition-hold, renders a distinct "Securing…" state instead of the settled "Got" stamp. See `hooks/use-kappa-tracker.ts`. */
  isTransitioning: boolean;
  onToggle: (itemId: string, itemName: string) => void;
}

/**
 * One Kappa/hideout checklist item: icon, name, need count, and a got
 * toggle spanning the whole card (click anywhere toggles, matching
 * legacy's `kappa.js`). Deliberately not a hand-rolled animated SVG ring
 * (legacy's literal "filling ring" visual): the transition-hold's
 * functional behavior (pinned sort position, delayed settle) is ported,
 * but the visual is simplified to a plain badge-state change, consistent
 * with this project's precedent of dropping legacy UI novelties while
 * keeping the underlying logic.
 */
export function KappaItemCard({ item, isTransitioning, onToggle }: KappaItemCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onToggle(item.id, item.name);
      }}
      aria-pressed={item.got}
      className="border-border bg-card hover:bg-accent flex flex-col items-center gap-2 rounded-md border p-3 text-center text-sm transition-colors"
    >
      {item.iconLink && (
        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
        <img src={item.iconLink} alt="" className="h-10 w-10 object-contain" />
      )}
      <span className="line-clamp-2 font-medium">{item.name}</span>
      <span className="text-muted-foreground text-xs">Need {item.need}</span>
      {isTransitioning ? (
        <Badge variant="amber">Securing…</Badge>
      ) : (
        item.got && <Badge variant="green">✓ Got</Badge>
      )}
    </button>
  );
}
