"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./Footer";

/**
 * Wraps `Footer` so it can be skipped on routes that need the full viewport,
 * without turning the root layout itself into a client component. Maps and
 * Progress Tracker are full-bleed viewport features (see `MapsPage`'s doc
 * comment) - the footer being reachable "below the fold" there just added
 * dead scroll space below a screen meant to fill the viewport.
 */
const NO_FOOTER_ROUTES = ["/maps", "/progress-tracker"];

/**
 *
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (NO_FOOTER_ROUTES.some((route) => pathname.startsWith(route))) return null;
  return <Footer />;
}
