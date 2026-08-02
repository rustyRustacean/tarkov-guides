"use client";

import { useCompanionAutoLaunch } from "./use-companion";
import { useCompanionProfileSync } from "./use-companion-profile-sync";

/**
 * Renders nothing; exists so the companion's app-wide side effects run
 * *inside* the QueryClient provider. They use react-query, so they can't live
 * in the `Providers` component body (that runs above its own provider) - they
 * have to be a child within the tree.
 */
export function CompanionAutoLauncher() {
  useCompanionAutoLaunch();
  useCompanionProfileSync();
  return null;
}
