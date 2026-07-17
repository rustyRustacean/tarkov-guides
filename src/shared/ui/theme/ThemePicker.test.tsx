import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { THEMES } from "./theme-config";
import { ThemePicker } from "./ThemePicker";
import { ThemeProvider } from "./ThemeProvider";

describe("ThemePicker", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("opens via keyboard, lists every theme, and marks the active one", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Change theme" });
    trigger.focus();
    await user.keyboard("{Enter}");

    for (const meta of THEMES) {
      expect(
        screen.getByRole("menuitemradio", { name: new RegExp(meta.name) }),
      ).toBeInTheDocument();
    }

    expect(screen.getByRole("menuitemradio", { name: /Inventory Grid/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("switches the active theme when a different item is selected", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemePicker />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Change theme" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Tactical Terminal/ }));

    expect(document.documentElement.getAttribute("data-theme")).toBe("terminal");
  });
});
