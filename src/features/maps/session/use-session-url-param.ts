"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const SESSION_PARAM = "session";

export interface UseSessionUrlParamResult {
  /** A join code found in the URL (`?session=CODE`), or `null` if none/already resolved. */
  pendingJoinCode: string | null;
  /** Call once the caller has resolved the pending code (joined or dismissed). Strips the param so a refresh/back-nav doesn't re-trigger the join dialog. */
  clearPendingJoinCode: () => void;
}

/**
 * Reads a `?session=CODE` invite-link param so `SessionControls` can
 * auto-*open* `JoinSessionDialog` pre-filled with it. Deliberately never
 * auto-joins silently, since a display name always needs confirming and
 * joining is a real side effect. Requires a `Suspense` boundary around its
 * caller (`useSearchParams`'s own Next.js requirement); see
 * `MapScreenLayout.tsx`'s use of `SessionControls`.
 */
export function useSessionUrlParam(): UseSessionUrlParamResult {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const paramValue = searchParams.get(SESSION_PARAM);

  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(paramValue);

  // Adjusts state directly during render (rather than via an effect) when
  // the URL's own `?session=` param changes, e.g. a fresh invite-link
  // navigation while this hook is already mounted. Same "derive state from a
  // changed external value" pattern as `SessionEntryDialog.tsx`'s tab/code
  // syncing, for the same reason: an effect would apply the new value one
  // render late.
  const [prevParamValue, setPrevParamValue] = useState(paramValue);
  if (paramValue !== prevParamValue) {
    setPrevParamValue(paramValue);
    if (paramValue) setPendingJoinCode(paramValue);
  }

  function clearPendingJoinCode(): void {
    setPendingJoinCode(null);
    if (searchParams.get(SESSION_PARAM) === null) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(SESSION_PARAM);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return { pendingJoinCode, clearPendingJoinCode };
}
