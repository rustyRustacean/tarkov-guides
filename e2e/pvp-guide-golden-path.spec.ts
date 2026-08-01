import { expect, test } from "@playwright/test";

test.describe("PvP Guide golden path", () => {
  test("visit the hub, switch tabs, open a tutorial, and use prev/next nav", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/pvp-guide");
    await expect(page.getByRole("heading", { name: "PvP Movement Mastery" })).toBeVisible();

    // Quick Start is the default tab.
    await expect(page.getByText("Quick Start: The Essentials")).toBeVisible();

    // Switch to Full Guide - a flat, title-only list (no tier grouping) - and open the first chapter.
    await page.getByRole("tab", { name: "Full Guide" }).click();
    await page
      .getByRole("link", { name: /Understanding Tarkov Movement/ })
      .first()
      .click();

    await expect(page).toHaveURL(/\/pvp-guide\/circle-strafing$/);
    await expect(
      page.getByRole("heading", {
        name: "Understanding Tarkov Movement: Inertia Basics",
        level: 1,
      }),
    ).toBeVisible();
    await expect(page.getByText("Tutorial 1 of 6")).toBeVisible();

    // No "Previous" link on the first tutorial, but a real "Next" link.
    await expect(page.getByText("Previous")).toHaveCount(0);
    await page.getByRole("link", { name: /Next/ }).click();

    await expect(page).toHaveURL(/\/pvp-guide\/peeking-essentials$/);
    await expect(page.getByText("Tutorial 2 of 6")).toBeVisible();

    // Back link returns to the hub.
    await page.getByRole("link", { name: "Back to PvP Guide" }).click();
    await expect(page).toHaveURL(/\/pvp-guide$/);

    expect(consoleErrors).toEqual([]);
  });

  test("header nav and homepage card both link to the real route", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Open PvP Guide →" }).click();
    await expect(page).toHaveURL(/\/pvp-guide$/);

    await page.goto("/");
    await page.getByRole("link", { name: "PvP Guide", exact: true }).click();
    await expect(page).toHaveURL(/\/pvp-guide$/);
  });
});
