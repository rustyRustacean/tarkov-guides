"use client";

import { createContext, useCallback, useSyncExternalStore } from "react";

import {
  DEFAULT_THEME_ID,
  isThemeId,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
  type ThemeMeta,
} from "./theme-config";

interface ThemeContextValue {
  /** The currently active theme id. */
  theme: ThemeId;
  /** Switches the active theme, updating the DOM, localStorage, and this context. */
  setTheme: (id: ThemeId) => void;
  /** Metadata for every selectable theme, for rendering a picker. */
  themes: readonly ThemeMeta[];
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Module-level subscriber list backing the `useSyncExternalStore` below.
 * The `data-theme` attribute on `<html>` is genuinely external state (set
 * by the pre-hydration blocking script, mutated by `setTheme`), so a
 * plain module singleton is the correct scope - there is only ever one
 * `<html>` element, and thus only ever one true value to track.
 */
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ThemeId {
  const current = document.documentElement.dataset.theme;
  return isThemeId(current) ? current : DEFAULT_THEME_ID;
}

/** Used only for the server-rendered pass, where `document` doesn't exist. */
function getServerSnapshot(): ThemeId {
  return DEFAULT_THEME_ID;
}

/**
 * Provides the active theme to the component tree.
 *
 * Reads the current theme via `useSyncExternalStore` rather than
 * `useState`, since the real source of truth - the `data-theme` attribute
 * on `<html>` - lives outside React (set by the `beforeInteractive`
 * blocking script before hydration even starts). `useSyncExternalStore` is
 * React's purpose-built primitive for exactly this: it uses
 * {@link getServerSnapshot} during the server-rendered pass (avoiding a
 * hydration mismatch) and automatically resolves to the real DOM value on
 * the client, with no manual `useEffect` resync and no `isLoaded` gating
 * required (the specific flaw being fixed here - see
 * `old/tarkov-tips/src/providers/ThemeProvider.tsx` for what NOT to do).
 * Critically, the *visible* theme (all CSS colors) is already correct from
 * first paint regardless, via the blocking script and pure CSS attribute
 * selectors - this hook only keeps React-rendered UI (e.g. a picker's
 * checkmark) in sync with that same value.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((id: ThemeId) => {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // localStorage unavailable (private browsing, disabled storage, etc.)
      // - the theme still applies for this session via the DOM attribute.
    }
    listeners.forEach((listener) => {
      listener();
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
