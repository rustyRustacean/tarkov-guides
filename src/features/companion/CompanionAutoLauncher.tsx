"use client";

import { useEffect } from "react";

import { useDeviceSyncStore } from "./device-sync-store";
import { useCompanionAutoLaunch } from "./use-companion";
import { useCompanionProfileSync } from "./use-companion-profile-sync";
import { useCompanionTaskSync } from "./use-companion-task-sync";
import { useDeviceSync } from "./use-device-sync";

/**
 * Renders nothing; exists so the companion's app-wide side effects run
 * *inside* the QueryClient provider. They use react-query, so they can't live
 * in the `Providers` component body (that runs above its own provider) - they
 * have to be a child within the tree.
 */
export function CompanionAutoLauncher() {
  const restore = useDeviceSyncStore((state) => state.restore);
  // Restore the saved pairing on mount (never in initial state, so the first
  // client render matches SSR).
  useEffect(() => {
    restore();
  }, [restore]);

  useCompanionAutoLaunch();
  useCompanionProfileSync();
  useCompanionTaskSync();
  useDeviceSync();
  return null;
}
