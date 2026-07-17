import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, resolving conflicting Tailwind utilities (e.g.
 * `"p-2"` + `"p-4"` → `"p-4"`) rather than concatenating both. The
 * standard `clsx` + `tailwind-merge` pairing used throughout `shared/ui`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
