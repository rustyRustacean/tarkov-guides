"use client";

import dynamic from "next/dynamic";

/**
 * `DetailDialogs` pulls in the 1,000+-line `QuestDetailDialog` and the
 * ~500-line `ItemDetailDialog`, both mounted app-wide via `providers.tsx`
 * (the root layout), so every route's client bundle carried both even
 * though most routes (home, FAQ, external-resources, PvP guide) can't open
 * either dialog at all. Loaded via `next/dynamic` with `ssr: false`, same
 * pattern as `MapViewerLazy.tsx`, so both dialogs live in their own chunk,
 * fetched only once something actually calls
 * `useItemDetailStore.getState().openItem()`/`.openTask()`. No `loading`
 * fallback needed: both dialogs already render nothing until the store's
 * `current` is set, so "not loaded yet" and "loaded but closed" look
 * identical; a genuinely closed dialog is the correct loading state.
 */
export const DetailDialogsLazy = dynamic(
  () => import("./DetailDialogs").then((mod) => ({ default: mod.DetailDialogs })),
  { ssr: false },
);
