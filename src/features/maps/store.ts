import { create } from "zustand";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { omitKey } from "@/shared/lib/record-utils";

import { DEFAULT_TOP_DOLLAR_THRESHOLD_RUB } from "./lib/map-valuables";
import { emptyMapProfileState } from "./types";

import type { MapsSnapshot } from "./persistence/types";
import type { CustomMapEntry, MapAnnotationLayer, MapProfileState } from "./types";

export interface MapsState {
  currentMap: string;
  /**
   * mapNormalizedName -> selected variantId. Each map remembers its own last
   * choice (Overview / Satellite View / 2D / 3D / ...), so switching away and
   * back restores that map's variant. Session-scoped - held in
   * `sessionStorage`, not the durable snapshot, so it survives reloads within
   * the tab but resets to each map's default (Overview) once the tab is
   * closed. A map with no entry falls back to its default (see
   * `resolveVariantId`).
   */
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
  /** Sets one map's variant (see `mapVariants`); also mirrored into `sessionStorage` so the choice survives a reload but not tab close. */
  setMapVariant: (normalizedName: string, variantId: string) => void;
  /** Restores the session-scoped `mapVariants` from `sessionStorage`. Client-only, called once from a mount effect (see `use-hydrate-on-mount.ts`) - never from the initial state, which must match SSR. */
  restoreSessionMapVariants: () => void;
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

/**
 * `sessionStorage` key backing `mapVariants`. `sessionStorage` (not
 * `localStorage`) is deliberate: each map's chosen variant should survive a
 * reload within the same tab but reset to the default once the tab is closed -
 * the "session-scoped" behavior this key exists to provide.
 */
const MAP_VARIANTS_SESSION_KEY = "tg.maps.mapVariants";

/** Reads the session-scoped per-map variant selections, tolerating SSR (no `window`), blocked storage, and malformed JSON. */
function readSessionMapVariants(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(MAP_VARIANTS_SESSION_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Persists the session-scoped per-map variant selections, tolerating SSR and blocked storage. */
function writeSessionMapVariants(mapVariants: Readonly<Record<string, string>>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MAP_VARIANTS_SESSION_KEY, JSON.stringify(mapVariants));
  } catch {
    // Private-mode / disabled storage - the in-memory store value still works
    // for the current page; only reload-survival is lost.
  }
}

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
    // Starts empty (identical on server and client) - the session-scoped
    // selections are restored from `sessionStorage` in a mount effect via
    // `restoreSessionMapVariants`, NOT read here. Reading `sessionStorage`
    // into the initial state would make the client's first render diverge
    // from the server's (which has no `window`), a hydration mismatch React
    // "won't patch up" - leaving Radix's tab state desynced.
    mapVariants: {},
    customMaps: {},
    customMapImageCache: {},
    profileState: {},
    showTaskMarkers: true,
    // On by default: there is no toolbar toggle for this, so a `false` default
    // meant the connector lines could never be turned on at all. They're the
    // only thing that shows which scattered pins belong to the same task.
    showTaskLinks: true,
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
      set((state) => {
        const mapVariants = { ...state.mapVariants, [normalizedName]: variantId };
        writeSessionMapVariants(mapVariants);
        return { mapVariants };
      });
    },

    restoreSessionMapVariants() {
      const stored = readSessionMapVariants();
      if (Object.keys(stored).length > 0) set({ mapVariants: stored });
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
      // `mapVariants` is intentionally NOT hydrated from the durable snapshot -
      // it's session-scoped (sessionStorage), not part of the persisted state.
      set({
        currentMap: snapshot.currentMap,
        customMaps: snapshot.customMaps,
        profileState: snapshot.profileState,
        topDollarThresholdRub: snapshot.topDollarThresholdRub,
      });
    },
  };
});
