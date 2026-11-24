"use client";

import { usePathname } from "next/navigation";

import { isChromelessPath } from "./chromeless-routes";

import type { ReactNode } from "react";

/**
 * Renders its children everywhere except on chromeless routes (see
 * `chromeless-routes.ts`). Lets the root layout drop the header and banners
 * for an embeddable page without itself becoming a client component.
 */
export function HideOnChromelessRoutes({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isChromelessPath(pathname)) return null;
  return children;
}
