import { expect, test } from "@playwright/test";

import { createProfile, mockTarkovApi } from "./helpers/progress-tracker";

// TODO: the Items tab is only temporarily WIP-disabled (see ProgressTrackerPage.tsx) - both
// tests below live entirely on that tab. Remove the `test.skip` calls once that flag comes
// off; the test bodies should keep working unmodified.
test.describe("Progress Tracker raid-commit undo", () => {
  test("Extracted moves pending items to stash, with a working undo", async ({ page }) => {
    test.skip(true, "Items tab is WIP-disabled");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await mockTarkovApi(page);
    await page.goto("/progress-tracker");
    await createProfile(page, "RaidProfile");

    // QuestBoard defaults to the Tree view; switch to List so the
    // `getByRole("listitem")` queries below have something to match.
    await page.getByRole("tab", { name: "List" }).click();

    const questCard = page.getByRole("listitem").filter({ hasText: "Secure the Alpha Widget" });
    await questCard.getByRole("button", { name: "Start" }).click();

    await page.getByRole("tab", { name: "Items" }).click();
    const itemRow = page.getByRole("listitem").filter({ hasText: "Alpha Widget" });
    const increaseButton = itemRow.getByRole("button", { name: "Increase pending Alpha Widget" });
    await increaseButton.click();
    await increaseButton.click();

    await expect(page.getByText("2 pending items this raid")).toBeVisible();

    await page.getByRole("button", { name: "Extracted", exact: true }).click();

    await expect(page.getByText("No pending items")).toBeVisible();
    await expect(page.getByText("Extracted - 2 items moved to stash").first()).toBeVisible();

    await page.getByRole("button", { name: "Show Collected" }).click();
    const collectedItemRow = page.getByRole("listitem").filter({ hasText: "Alpha Widget" });
    // Not `getByLabel("Have")`: that substring-matches 3 elements in this
    // row (the stash input's "Have {name}" label, plus the pending
    // decrease/increase buttons' "Decrease/Increase Have {name}" labels),
    // a Playwright strict-mode violation. Scoping to the spinbutton role
    // isolates the `<input type="number">` uniquely - the buttons have
    // role "button".
    await expect(collectedItemRow.getByRole("spinbutton", { name: "Have" })).toHaveValue("2");

    await page.getByRole("button", { name: "UNDO", exact: true }).click();

    await expect(page.getByText("2 pending items this raid")).toBeVisible();
    const revertedItemRow = page.getByRole("listitem").filter({ hasText: "Alpha Widget" });
    await expect(revertedItemRow.getByRole("spinbutton", { name: "Have" })).toHaveValue("0");

    expect(consoleErrors).toEqual([]);
  });

  test("Died discards pending items without touching stash, with a working undo", async ({
    page,
  }) => {
    test.skip(true, "Items tab is WIP-disabled");

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await mockTarkovApi(page);
    await page.goto("/progress-tracker");
    await createProfile(page, "DiedProfile");

    // QuestBoard defaults to the Tree view; switch to List so the
    // `getByRole("listitem")` queries below have something to match.
    await page.getByRole("tab", { name: "List" }).click();

    const questCard = page.getByRole("listitem").filter({ hasText: "Secure the Beta Widget" });
    await questCard.getByRole("button", { name: "Start" }).click();

    await page.getByRole("tab", { name: "Items" }).click();
    const itemRow = page.getByRole("listitem").filter({ hasText: "Beta Widget" });
    const increaseButton = itemRow.getByRole("button", { name: "Increase pending Beta Widget" });
    await increaseButton.click();
    await increaseButton.click();
    await increaseButton.click();

    await expect(page.getByText("3 pending items this raid")).toBeVisible();
    // Not `getByLabel("Have")`: that substring-matches 3 elements in this
    // row (the stash input's "Have {name}" label, plus the pending
    // decrease/increase buttons' "Decrease/Increase Have {name}" labels),
    // a Playwright strict-mode violation. Scoping to the spinbutton role
    // isolates the `<input type="number">` uniquely - the buttons have
    // role "button".
    await expect(itemRow.getByRole("spinbutton", { name: "Have" })).toHaveValue("0");

    await page.getByRole("button", { name: "Died", exact: true }).click();

    await expect(page.getByText("No pending items")).toBeVisible();
    await expect(page.getByText("Died - 3 items lost").first()).toBeVisible();
    await expect(itemRow.getByRole("spinbutton", { name: "Have" })).toHaveValue("0");

    await page.getByRole("button", { name: "UNDO", exact: true }).click();

    await expect(page.getByText("3 pending items this raid")).toBeVisible();
    await expect(itemRow.getByRole("spinbutton", { name: "Have" })).toHaveValue("0");

    expect(consoleErrors).toEqual([]);
  });
});
