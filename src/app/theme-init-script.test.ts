import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_THEME_ID, THEME_IDS, THEME_STORAGE_KEY } from "@/shared/ui/theme/theme-config";

import { themeInitScript } from "./theme-init-script";

/** Executes the script body exactly as the `beforeInteractive` <Script> tag would. */
function runScript() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- this IS the code under test, run in isolation
  const run = new Function(themeInitScript) as () => void;
  run();
}

describe("themeInitScript", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it.each(THEME_IDS)("applies a validly stored theme id: %s", (id) => {
    localStorage.setItem(THEME_STORAGE_KEY, id);
    runScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe(id);
  });

  it("falls back to the default theme for an unrecognized stored value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "nonsense");
    runScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
  });

  it("falls back to the default theme when localStorage is empty", () => {
    runScript();
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME_ID);
  });
});
