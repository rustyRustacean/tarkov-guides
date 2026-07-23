"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./Footer";

/**
 * Wraps `Footer` so it can be skipped on routes that need the full viewport,
 * without turning the root layout itself into a client component. Maps is a
 * full-bleed viewport feature (see `MapsPage`'s doc comment) - the footer
 * being reachable "below the fold" there just added dead scroll space below
 * a screen meant to fill the viewport.
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/maps")) return null;
  return <Footer />;
}
