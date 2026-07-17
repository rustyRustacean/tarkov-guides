import { useContext } from "react";

import { ThemeContext } from "./ThemeProvider";

/** Reads the active theme and a setter from the nearest {@link ThemeProvider}. */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
