"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { useCustomMapUpload } from "../hooks/use-custom-map-upload";
import { useMapVariants } from "../hooks/use-map-variants";
import { getMapConfig } from "../lib/map-config";
import { useMapsStore } from "../store";

import { AddCustomMapDialog } from "./AddCustomMapDialog";

interface Props {
  normalizedName: string;
}

/**
 * Switches which of a map's variants (Interactable/Overview/2D/3D/... plus
 * any of the user's own uploads) is shown - ported from legacy's `#msel`
 * `<select>` (`goMap`/`switchVariant` in `mapHeader.js`/`fullscreen.js`),
 * restyled as a `Tabs` trigger row. Reads `useMapVariants` (not
 * `config.variants` directly) so custom uploads actually appear here - see
 * the Phase 5 step 12 plan for why that merge didn't exist until this step.
 * Also owns the "+ Add Custom Map" trigger and each custom variant's delete
 * affordance, since this component's whole job is "manage which variant is
 * showing."
 */
export function MapVariantSwitcher({ normalizedName }: Props) {
  const config = getMapConfig(normalizedName);
  const variants = useMapVariants(normalizedName, config?.variants ?? []);
  const storedVariantId = useMapsStore((state) => state.mapVariants[normalizedName]);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);
  const { removeCustomMap } = useCustomMapUpload();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!config) return null;

  // The `?? ""` fallback is unreachable when `variants` is non-empty -
  // `noUncheckedIndexedAccess` can't see that guard, so this just satisfies
  // the type checker without a non-null assertion.
  const activeVariantId =
    storedVariantId ?? variants.find((v) => v.id === "overview")?.id ?? variants[0]?.id ?? "";

  return (
    <div className="flex items-center gap-1">
      {variants.length > 0 && (
        <Tabs
          value={activeVariantId}
          onValueChange={(variantId) => {
            setMapVariant(normalizedName, variantId);
          }}
        >
          <TabsList>
            {variants.map((variant) => (
              // A wrapping `div`, not a nested interactive element inside
              // `TabsTrigger` - Radix's `TabsTrigger` renders a real
              // `<button>`, and a `role="button"` delete affordance nested
              // inside it is both invalid HTML (nested interactive content)
              // and, confirmed via a failing test, not reliably isolated
              // from Radix's roving-focus-group activation even with
              // `stopPropagation()` on every pointer/focus/click handler -
              // Radix tracks focus at the native-listener level, outside
              // React's synthetic event system. Keeping the delete button as
              // a sibling instead sidesteps the whole class of problem.
              <div key={variant.id} className="flex items-center">
                <TabsTrigger value={variant.id}>{variant.label}</TabsTrigger>
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
