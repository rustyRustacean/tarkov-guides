"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { kitFromHash, kitHash, presetFromHash } from "../lib/kit-links";
import { emptyKit } from "../lib/preset-schema";

import type { Kit, Preset } from "../types";

/** How long after the last edit the address bar is updated. */
const HASH_WRITE_DELAY_MS = 400;

/**
 * A kit kept in the URL fragment: read once on load (a shared kit link
 * opens with its kit), then written back shortly after each edit, so a
 * reload or a copied address bar keeps the kit. With `withPreset`, the
 * fragment also carries a standalone preset (`#p=`), which is read but
 * never changed here.
 */
export function useHashKit(withPreset: boolean): {
  kit: Kit;
  setKit: (kit: Kit) => void;
  preset: Preset | null;
  loaded: boolean;
} {
  const [kit, setKitState] = useState<Kit>(emptyKit);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const hash = window.location.hash;
    void Promise.all([kitFromHash(hash), withPreset ? presetFromHash(hash) : null]).then(
      ([fromLink, presetFromLink]) => {
        if (cancelled) return;
        if (fromLink) setKitState(fromLink);
        setPreset(presetFromLink);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [withPreset]);

  const setKit = useCallback(
    (next: Kit) => {
      setKitState(next);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void kitHash(next, preset ?? undefined).then((hash) => {
          const { pathname, search } = window.location;
          window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
        });
      }, HASH_WRITE_DELAY_MS);
    },
    [preset],
  );

  return { kit, setKit, preset, loaded };
}
