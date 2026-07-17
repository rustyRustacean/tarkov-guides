import { expect, test } from "@playwright/test";

test.describe("theme switching", () => {
  test("defaults to inventory, switches themes via the picker, and persists across reload", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "inventory");
    // inventory's background (a repeating grid pattern) is set directly on
    // <html>, not <body> - see [data-theme="inventory"] in globals.css.
    const initialBgImage = await page
      .locator("html")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(initialBgImage).toContain("gradient");

    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitemradio", { name: /Tactical Terminal/ }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "terminal");
    const terminalBg = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const terminalBgImage = await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(terminalBgImage).toBe("none");
    expect(terminalBg).toBe("rgb(5, 8, 5)"); // --bg for [data-theme="terminal"]

    // Reload - the anti-FOUC blocking script should read localStorage and
    // re-apply "terminal" before first paint, with no flash back to inventory.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "terminal");

    expect(consoleErrors).toEqual([]);
  });

  test("falls back to inventory when the stored theme id is invalid", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("tarkovguides.theme.v1", "not-a-real-theme");
    });

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "inventory");
  });
});
