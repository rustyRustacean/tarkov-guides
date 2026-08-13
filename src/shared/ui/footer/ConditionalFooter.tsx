"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./Footer";

/** Routes that need the full viewport, where the footer would just add dead scroll space below the fold. */
const NO_FOOTER_ROUTES = ["/maps", "/progress-tracker"];

/**
 * Wraps `Footer` so it can be skipped on routes that need the full viewport,
 * without turning the root layout itself into a client component.
 */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (NO_FOOTER_ROUTES.some((route) => pathname.startsWith(route))) return null;
  return <Footer />;
}
