import { create } from "zustand";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { omitKey } from "@/shared/lib/record-utils";

import { DEFAULT_TOP_DOLLAR_THRESHOLD_RUB } from "./lib/map-valuables";
import { emptyMapProfileState } from "./types";

import type { MapsSnapshot } from "./persistence/types";
import type { CustomMapEntry, MapAnnotationLayer, MapProfileState } from "./types";

export interface MapsState {
  currentMap: string;
  /** mapNormalizedName -> variantId. Shared across profiles - matches confirmed legacy behavior. */
  mapVariants: Readonly<Record<string, string>>;
  /** mapNormalizedName -> custom variant metadata. Shared across profiles - image bytes live in IndexedDB, see `persistence/custom-map-idb.ts`. */
  customMaps: Readonly<Record<string, readonly CustomMapEntry[]>>;
  /** variantId -> resolved image data URL, lazily populated from IndexedDB by `hooks/use-map-variants.ts`. Ephemeral (not part of `MapsSnapshot`) - rebuilt from IndexedDB each session, same reasoning as every other ephemeral field here. */
  customMapImageCache: Readonly<Record<string, string>>;
  /** profileId -> per-profile Maps state. Scoped by Progress Tracker's `activeProfileId`, read (never written) via `useProgressTrackerStore.getState()` - see the module doc comment below. */
  profileState: Readonly<Record<string, MapProfileState>>;

  showTaskMarkers: boolean;
  showTaskLinks: boolean;
  showTaskNames: boolean;
  /** Which of the sidebar's panes is focused (Items / Tasks / Flea Market) - ephemeral, session-only UI state (not part of `MapsSnapshot`), same convention as `showTaskMarkers` etc. Mirrors legacy's `setSidebarFocus`, minus persistence (see the Phase 5 step 9 plan). */
  sidebarPane: "items" | "tasks" | "flea";
  /** The Valuables panel's "Top Dollar" price cutoff, in roubles. Shared across profiles (matches legacy's flat `state.topDollarThreshold`) and persisted, unlike `sidebarPane`. */
  topDollarThresholdRub: number;
  /** Whether the map viewport is in real Fullscreen API mode - ephemeral, synced from the browser's own `fullscreenchange` event (see `hooks/use-fullscreen.ts`), never persisted (a reload should never re-enter fullscreen). */
  mapFullscreen: boolean;
  /** Whether the Items/Tasks/Flea sidebar (desktop only - mobile uses the drag sheet instead) is collapsed - ephemeral, defaults to `false` (visible) so the sidebar stays visible until the user hides it. */
  leftPanelCollapsed: boolean;
  /** Whether the mobile bottom sheet (the Items/Tasks sidebar, on narrow viewports) is open - ephemeral, defaults closed. */
  mobileSheetOpen: boolean;

  setCurrentMap: (normalizedName: string) => void;
  setMapVariant: (normalizedName: string, variantId: string) => void;
  addCustomMap: (normalizedName: string, entry: CustomMapEntry) => void;
  /** Also clears the matching `customMapImageCache` entry, if any - the image itself is deleted from IndexedDB by the caller (see `hooks/use-custom-map-upload.ts`). */
  removeCustomMap: (normalizedName: string, variantId: string) => void;
  setCustomMapImage: (variantId: string, dataUrl: string) => void;
  setShowTaskMarkers: (on: boolean) => void;
  setShowTaskLinks: (on: boolean) => void;
  setShowTaskNames: (on: boolean) => void;
  setSidebarPane: (pane: "items" | "tasks" | "flea") => void;
  setTopDollarThreshold: (rub: number) => void;
  setMapFullscreen: (on: boolean) => void;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setMobileSheetOpen: (open: boolean) => void;

  /** Full replace of one map+variant's annotation layer - the cascade (add/undo/clear-with-pending-stash, lock containment) lives in `lib/annotations.ts`, called by a hook that computes the new layer and passes it here. Falls back to `ANONYMOUS_PROFILE_ID`'s bucket if there's no active profile. */
  setAnnotationLayer: (
    mapNormalizedName: string,
    variantId: string,
    layer: MapAnnotationLayer,
  ) => void;
  /** `undefined` clears the override, reverting to the default (only `inprog` tasks show). Falls back to `ANONYMOUS_PROFILE_ID`'s bucket if there's no active profile. */
  setTaskDisplayOverride: (taskId: string, show: boolean | undefined) => void;

  /** Full-state load from a persisted snapshot - called once on mount and by import/restore. */
  hydrate: (snapshot: MapsSnapshot) => void;
}

/**
 * Reads Progress Tracker's active profile id imperatively (not as a React
 * hook subscription) purely as a scoping key for this feature's own
 * per-profile bucket - deliberately does NOT import/extend
 * `ProfileProgress`/`ProgressTrackerSnapshot`, so Maps' persistence stays
 * entirely independent of Progress Tracker's. Mirrors, rather than merges
 * into, that store's own per-profile bucketing pattern (see its
 * `updateActiveProgress` closure) - the only difference is the id comes
 * from a different store's `getState()` instead of this store's own state.
 */
function activeProfileId(): string | null {
  return useProgressTrackerStore.getState().activeProfileId;
}

/**
 * Bucket key for annotations/task-display-overrides made with no active
 * Progress Tracker profile - e.g. drawing on a map before ever setting one
 * up. Keeps that state real and persisted (not silently dropped) rather than
 * requiring profile setup as a prerequisite for using the map's draw tools.
 * Never migrated into a real profile's bucket if one is created later - it's
 * just another `profileState` entry, same as an orphaned bucket left behind
 * by a deleted profile.
 */
export const ANONYMOUS_PROFILE_ID = "__local__";

export const useMapsStore = create<MapsState>((set, get) => {
  /** Applies `updater` to the active profile's Maps state, falling back to `ANONYMOUS_PROFILE_ID` when none is active. */
  function updateActiveProfileState(updater: (state: MapProfileState) => MapProfileState): void {
    const profileId = activeProfileId() ?? ANONYMOUS_PROFILE_ID;
    const { profileState } = get();
    const current = profileState[profileId] ?? emptyMapProfileState();
    set({ profileState: { ...profileState, [profileId]: updater(current) } });
  }

  return {
    currentMap: "reserve",
    mapVariants: {},
    customMaps: {},
    customMapImageCache: {},
    profileState: {},
    showTaskMarkers: true,
    showTaskLinks: false,
    showTaskNames: false,
    sidebarPane: "items",
    topDollarThresholdRub: DEFAULT_TOP_DOLLAR_THRESHOLD_RUB,
    mapFullscreen: false,
    leftPanelCollapsed: false,
    mobileSheetOpen: false,

    setCurrentMap(normalizedName) {
      set({ currentMap: normalizedName });
    },

    setMapVariant(normalizedName, variantId) {
      set((state) => ({ mapVariants: { ...state.mapVariants, [normalizedName]: variantId } }));
    },

    addCustomMap(normalizedName, entry) {
      set((state) => ({
        customMaps: {
          ...state.customMaps,
          [normalizedName]: [...(state.customMaps[normalizedName] ?? []), entry],
        },
      }));
    },

    removeCustomMap(normalizedName, variantId) {
      set((state) => ({
        customMaps: {
          ...state.customMaps,
          [normalizedName]: (state.customMaps[normalizedName] ?? []).filter(
            (entry) => entry.id !== variantId,
          ),
        },
        customMapImageCache: omitKey(state.customMapImageCache, variantId),
      }));
    },

    setCustomMapImage(variantId, dataUrl) {
      set((state) => ({
        customMapImageCache: { ...state.customMapImageCache, [variantId]: dataUrl },
      }));
    },

    setShowTaskMarkers(on) {
      set({ showTaskMarkers: on });
    },

    setShowTaskLinks(on) {
      set({ showTaskLinks: on });
    },

    setShowTaskNames(on) {
      set({ showTaskNames: on });
    },

    setSidebarPane(pane) {
      set({ sidebarPane: pane });
    },

    setTopDollarThreshold(rub) {
      set({ topDollarThresholdRub: rub });
    },

    setMapFullscreen(on) {
      set({ mapFullscreen: on });
    },

    setLeftPanelCollapsed(collapsed) {
      set({ leftPanelCollapsed: collapsed });
    },

    setMobileSheetOpen(open) {
      set({ mobileSheetOpen: open });
    },

    setAnnotationLayer(mapNormalizedName, variantId, layer) {
      updateActiveProfileState((state) => ({
        ...state,
        annotations: {
          ...state.annotations,
          [mapNormalizedName]: {
            ...state.annotations[mapNormalizedName],
            [variantId]: layer,
          },
        },
      }));
    },

    setTaskDisplayOverride(taskId, show) {
      updateActiveProfileState((state) => ({
        ...state,
        taskDisplayOverrides:
          show === undefined
            ? omitKey(state.taskDisplayOverrides, taskId)
            : { ...state.taskDisplayOverrides, [taskId]: show },
      }));
    },

    hydrate(snapshot) {
      set({
        currentMap: snapshot.currentMap,
        mapVariants: snapshot.mapVariants,
        customMaps: snapshot.customMaps,
        profileState: snapshot.profileState,
        topDollarThresholdRub: snapshot.topDollarThresholdRub,
      });
    },
  };
});
