import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "./theme-config";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./use-theme";

function Consumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button
        onClick={() => {
          setTheme("terminal");
        }}
      >
        switch to terminal
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to the default theme and lets consumers switch themes", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Consumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent(DEFAULT_THEME_ID);

    await user.click(screen.getByRole("button", { name: "switch to terminal" }));

    expect(screen.getByTestId("theme")).toHaveTextContent("terminal");
    expect(document.documentElement.getAttribute("data-theme")).toBe("terminal");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("terminal");
  });

  it("useTheme throws when used outside a ThemeProvider", () => {
    // React logs an additional error to the console when a component throws
    // during render; suppress it so the expected failure doesn't pollute
    // test output.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Consumer />)).toThrow("useTheme must be used within a ThemeProvider");

    consoleError.mockRestore();
  });
});
