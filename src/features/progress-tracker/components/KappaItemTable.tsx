import { Badge } from "@/shared/ui/badge/Badge";

import type { KappaItem } from "../lib/kappa";

export interface KappaItemTableProps {
  items: readonly KappaItem[];
  /** Item ids mid the 1.5s transition-hold. See `hooks/use-kappa-tracker.ts`. */
  justGotIds: ReadonlySet<string>;
  onToggle: (itemId: string, itemName: string) => void;
}

/** Dense row-per-item view of the same checklist `KappaItemCard` renders as a grid. No shared `Table` primitive exists yet, and one consumer doesn't justify adding one. */
export function KappaItemTable({ items, justGotIds, onToggle }: KappaItemTableProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-border text-muted-foreground border-b text-left">
          <th className="py-2 font-medium">Item</th>
          <th className="py-2 font-medium">Need</th>
          <th className="py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const isTransitioning = justGotIds.has(item.id);
          return (
            <tr key={item.id} className="border-border border-b last:border-b-0">
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => {
                    onToggle(item.id, item.name);
                  }}
                  aria-pressed={item.got}
                  className="hover:text-accent-foreground flex items-center gap-2 text-left"
                >
                  {item.iconLink && (
                    // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                    <img src={item.iconLink} alt="" className="h-6 w-6 object-contain" />
                  )}
                  {item.name}
                </button>
              </td>
              <td className="py-2">{item.need}</td>
              <td className="py-2">
                {isTransitioning ? (
                  <Badge variant="amber">Securing…</Badge>
                ) : item.got ? (
                  <Badge variant="green">✓ Got</Badge>
                ) : (
                  <Badge variant="outline">Needed</Badge>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
