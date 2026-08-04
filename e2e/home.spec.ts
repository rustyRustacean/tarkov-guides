import { expect, test } from "@playwright/test";

test("homepage loads without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto("/");

  await expect(page.getByRole("main")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("hero animation canvas renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
});

test("primary hero CTA navigates to the Progress Tracker", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Open Progress Tracker →", exact: true }).click();

  await expect(page).toHaveURL(/\/progress-tracker$/);
  await expect(page.getByRole("heading", { name: "Progress Tracker", level: 1 })).toBeVisible();
});

// Disabled 2026-08-02 per user request - the three coming-soon cards
// themselves are commented out in `src/app/page.tsx` (see
// `COMING_SOON_FEATURES`' doc comment there), and `src/app/page.test.tsx`'s
// unit-test equivalent was already commented out alongside them. This e2e
// spec wasn't updated at the time, so it kept failing (expects 3 buttons,
// finds 0) - commented out to match, not deleted, so it's easy to restore
// whenever the coming-soon cards come back.
// test("coming-soon feature cards are inert, not links", async ({ page }) => {
//   await page.goto("/");
//
//   const comingSoonButtons = page.getByRole("button", { name: "Coming Soon" });
//   await expect(comingSoonButtons).toHaveCount(3);
//   for (const button of await comingSoonButtons.all()) {
//     await expect(button).toBeDisabled();
//   }
//   await expect(page.getByRole("link", { name: "Coming Soon" })).toHaveCount(0);
// });
