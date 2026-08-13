"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Palette } from "lucide-react";

import { Button } from "../button/Button";

import { isThemeId } from "./theme-config";
import { useTheme } from "./use-theme";

/**
 * The site's theme switcher: a dropdown menu listing the 4 selectable
 * themes (see `theme-config.ts`), each with a name, description, and a
 * 4-color preview swatch. Built on Radix's `DropdownMenuRadioGroup`, which
 * gives correct `menuitemradio` semantics, roving focus, and arrow-key/
 * Home/End/Escape keyboard navigation with no hand-rolled ARIA wiring.
 */
export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();

  return (
    // `modal={false}`: Radix's default modal scroll lock sets
    // `overflow: hidden` on `<body>`, which makes `<body>` the nearest
    // scroll container for CSS purposes and breaks `Header.tsx`'s
    // `position: sticky` (it starts sticking relative to body's own
    // unscrolled position instead of the viewport, so the header jumps
    // off-screen by the current scroll offset the instant this opens).
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="Change theme">
          <Palette className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-border bg-popover text-popover-foreground z-50 w-72 rounded-md border p-1 shadow-lg"
        >
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => {
              if (isThemeId(value)) {
                setTheme(value);
              }
            }}
          >
            {themes.map((meta) => (
              <DropdownMenu.RadioItem
                key={meta.id}
                value={meta.id}
                className="hover:bg-accent data-[state=checked]:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-start gap-3 rounded-sm p-2 text-sm outline-none select-none"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  <DropdownMenu.ItemIndicator>
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{meta.name}</span>
                    <span className="flex gap-0.5" aria-hidden="true">
                      {meta.swatch.map((color, index) => (
                        <i
                          key={index}
                          className="border-border/50 h-3 w-3 rounded-full border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-xs">{meta.description}</span>
                </span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
