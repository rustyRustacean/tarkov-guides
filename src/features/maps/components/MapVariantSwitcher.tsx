"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { useCustomMapUpload } from "../hooks/use-custom-map-upload";
import { useMapVariants } from "../hooks/use-map-variants";
import { getMapConfig, resolveVariantId } from "../lib/map-config";
import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

import { AddCustomMapDialog } from "./AddCustomMapDialog";

interface Props {
  normalizedName: string;
}

/**
 * Switches which of a map's variants (Satellite View/Overview/2D/3D/... plus
 * any of the user's own uploads) is shown. Ported from legacy's `#msel`
 * `<select>` (`goMap`/`switchVariant` in `mapHeader.js`/`fullscreen.js`),
 * restyled as a `Tabs` trigger row. Reads `useMapVariants` (not
 * `config.variants` directly) so custom uploads actually appear here. Also
 * owns the "+ Add Custom Map" trigger and each custom variant's delete
 * affordance, since this component's whole job is "manage which variant is
 * showing."
 *
 * Rendered as a floating overlay on the map viewport itself (see
 * `MapScreenLayout.tsx`), not in the map-picker row, so the outer div owns
 * the translucent "floating chrome" treatment (matching the fullscreen
 * button/clock overlays) and `TabsList` is stripped of its usual opaque
 * `bg-muted` box so it doesn't nest one pill inside another.
 */
export function MapVariantSwitcher({ normalizedName }: Props) {
  const config = getMapConfig(normalizedName);
  const variants = useMapVariants(normalizedName, config?.variants ?? []);
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);
  const { removeCustomMap } = useCustomMapUpload();
  const [dialogOpen, setDialogOpen] = useState(false);
  const session = useMapsSession();
  const locked = session.active && !session.isController;

  if (!config) return null;

  // The active tab: this map's stored session selection when it has a
  // variant by that id, else the map's default (Overview). The same
  // resolver `MapViewer` uses, so the highlighted tab always matches what's
  // rendered.
  const activeVariantId = resolveVariantId(variants, storedVariantId ?? null);

  return (
    <div className="bg-background/90 border-border flex max-w-full items-center gap-1 rounded-lg border p-1 shadow-sm backdrop-blur-sm">
      {variants.length > 0 && (
        <Tabs
          value={activeVariantId}
          onValueChange={(variantId) => {
            if (locked) return;
            setMapVariant(normalizedName, variantId);
          }}
        >
          <TabsList className="h-auto flex-wrap bg-transparent p-0">
            {variants.map((variant) => (
              // A wrapping `div`, not a nested interactive element inside
              // `TabsTrigger`. Radix's `TabsTrigger` renders a real
              // `<button>`, and a `role="button"` delete affordance nested
              // inside it is both invalid HTML (nested interactive content)
              // and, confirmed via a failing test, not reliably isolated
              // from Radix's roving-focus-group activation even with
              // `stopPropagation()` on every pointer/focus/click handler:
              // Radix tracks focus at the native-listener level, outside
              // React's synthetic event system. Keeping the delete button as
              // a sibling instead sidesteps the whole class of problem.
              <div key={variant.id} className="flex items-center">
                <TabsTrigger
                  value={variant.id}
                  disabled={locked}
                  title={locked ? "Only the session driver can change maps" : undefined}
                >
                  {variant.label}
                </TabsTrigger>
                {variant.custom && (
                  <button
                    type="button"
                    onClick={() => {
                      removeCustomMap(normalizedName, variant.id);
                    }}
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    aria-label={`Remove ${variant.label}`}
                    title={`Remove ${variant.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => {
          setDialogOpen(true);
        }}
        aria-label="Add custom map"
        title="Add custom map"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <AddCustomMapDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        normalizedName={normalizedName}
      />
    </div>
  );
}
