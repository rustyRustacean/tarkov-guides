import { expect, test } from "@playwright/test";

import { createProfile, mockTarkovApi } from "./helpers/progress-tracker";

test.describe("Progress Tracker golden path", () => {
  test("create profile, complete a task, mark a custom item's stash count, reload, and confirm it all persisted", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await mockTarkovApi(page);
    await page.goto("/progress-tracker");

    await createProfile(page, "GoldenProfile");
    await expect(page.getByRole("button", { name: "GoldenProfile", exact: true })).toBeVisible();

    // QuestBoard defaults to the Tree view; switch to List so the
    // `getByRole("listitem")` queries below have something to match.
    await page.getByRole("tab", { name: "List" }).click();

    // Complete a task.
    const questCard = page.getByRole("listitem").filter({ hasText: "Secure the Alpha Widget" });
    await questCard.getByRole("button", { name: "Start" }).click();
    await expect(questCard.getByText("In Progress")).toBeVisible();
    await questCard.getByRole("button", { name: "Complete" }).click();
    await expect(questCard.getByText("Done", { exact: true })).toBeVisible();

    // Mark an item's stash count via a custom item (a completed task's own
    // item requirements stop being tracked once it's no longer `inprog` -
    // see `getTrackedItems` - so this exercises the general stash-editing
    // path rather than depending on the just-completed task's item).
    await page.getByRole("tab", { name: "Items" }).click();
    await page.getByRole("button", { name: "Add Custom Item" }).click();
    await page.getByLabel("Search items").fill("Alpha Widget");
    await page
      .getByRole("button", { name: /Alpha Widget/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Add Item" }).click();

    await expect(page.getByText("Custom Items (1)")).toBeVisible();
    const itemRow = page.getByRole("listitem").filter({ hasText: "Alpha Widget" });
    await expect(itemRow.getByText(/Remaining 1/)).toBeVisible();

    await itemRow.getByLabel("Have").fill("1");
    await expect(itemRow.getByText(/Remaining 0/)).toBeVisible();

    // Reload and confirm every piece of state above survived.
    await page.reload();

    await expect(page.getByRole("button", { name: "GoldenProfile", exact: true })).toBeVisible();
    // The Tabs default resets to Tree on remount, so switch back to List.
    await page.getByRole("tab", { name: "List" }).click();
    const questCardAfterReload = page
      .getByRole("listitem")
      .filter({ hasText: "Secure the Alpha Widget" });
    await expect(questCardAfterReload.getByText("Done", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Items" }).click();
    const itemRowAfterReload = page.getByRole("listitem").filter({ hasText: "Alpha Widget" });
    await expect(itemRowAfterReload.getByLabel("Have")).toHaveValue("1");
    await expect(itemRowAfterReload.getByText(/Remaining 0/)).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});
